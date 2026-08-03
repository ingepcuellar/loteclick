/**
 * OfflineDiagnostic.jsx
 * Pagina de diagnostico para inspeccionar y gestionar la cola de
 * sincronizacion offline (IndexedDB - syncQueue store).
 */
import { useState, useEffect, useCallback } from 'react';
import {
    FiRefreshCw, FiTrash2, FiSend, FiDatabase,
    FiAlertTriangle, FiCheckCircle, FiClock, FiX,
    FiEye, FiWifi, FiWifiOff
} from 'react-icons/fi';
import { getQueue, updateStatus, removeFromQueue, clearQueue } from '../../lib/syncQueue';
import { getAll } from '../../lib/offlineDB';
import { useOffline } from '../../context/OfflineContext';
import { formatCurrency } from '../../lib/formatters';

const STATUS_META = {
    pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Pendiente', icon: FiClock },
    syncing:  { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: 'Sincronizando', icon: FiRefreshCw },
    failed:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: 'Fallido', icon: FiAlertTriangle },
    conflict: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: 'Conflicto', icon: FiX },
    done:     { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  label: 'Completado', icon: FiCheckCircle },
};

function Badge({ status }) {
    const meta = STATUS_META[status] || STATUS_META.pending;
    const Icon = meta.icon;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: meta.bg, color: meta.color,
            padding: '3px 10px', borderRadius: 12,
            fontSize: 12, fontWeight: 600,
        }}>
            <Icon size={12} /> {meta.label}
        </span>
    );
}

function formatTS(ts) {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' });
}

function endpointName(ep) {
    if (!ep) return '';
    const m = ep.match(/endpoints\/(\w+)\.php/);
    if (m) return m[1].toUpperCase();
    return ep;
}

function methodColor(method) {
    const colors = { POST: '#22c55e', PUT: '#6366f1', PATCH: '#f59e0b', DELETE: '#ef4444', GET: '#94a3b8' };
    return colors[(method || '').toUpperCase()] || '#94a3b8';
}

export default function OfflineDiagnostic() {
    const { isOnline, isSyncing, forceSync, refreshPendingCount } = useOffline();

    const [queue, setQueue] = useState([]);
    const [offlineSales, setOfflineSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMutation, setSelectedMutation] = useState(null);
    const [syncResult, setSyncResult] = useState(null);
    const [tab, setTab] = useState('queue');

    const loadQueue = useCallback(async () => {
        setLoading(true);
        try {
            const all = await getQueue();
            setQueue(all);
        } catch (e) {
            console.error('[OfflineDiag] Error cargando cola:', e);
        }
        setLoading(false);
    }, []);

    const loadOfflineSales = useCallback(async () => {
        try {
            const sales = await getAll('sales');
            setOfflineSales(sales.filter(s => s._offline || s._pendingSync));
        } catch (e) {
            console.error('[OfflineDiag] Error cargando ventas offline:', e);
        }
    }, []);

    useEffect(() => {
        loadQueue();
        loadOfflineSales();
    }, [loadQueue, loadOfflineSales]);

    const handleForceSync = async () => {
        if (!isOnline) return;
        const result = await forceSync();
        setSyncResult(result);
        await loadQueue();
        await loadOfflineSales();
        await refreshPendingCount();
    };

    const handleRetryOne = async (mutationId) => {
        await updateStatus(mutationId, 'pending', null);
        await loadQueue();
        if (isOnline) await handleForceSync();
    };

    const handleDeleteOne = async (mutationId) => {
        if (!window.confirm('Eliminar esta mutacion de la cola? La operacion NO se enviara al servidor.')) return;
        await removeFromQueue(mutationId);
        await loadQueue();
        await refreshPendingCount();
    };

    const handleClearAll = async () => {
        if (!window.confirm('Eliminar TODA la cola de sincronizacion? Se descartaran todas las operaciones pendientes.')) return;
        await clearQueue();
        await loadQueue();
        await refreshPendingCount();
    };

    const stats = {
        total:    queue.length,
        pending:  queue.filter(m => m.status === 'pending').length,
        failed:   queue.filter(m => m.status === 'failed').length,
        conflict: queue.filter(m => m.status === 'conflict').length,
        sales:    queue.filter(m => (m.endpoint || '').includes('sales.php') && m.method === 'POST').length,
    };

    const cardStyle = (color) => ({
        background: 'rgba(' + color + ',0.1)',
        border: '1px solid rgba(' + color + ',0.25)',
        borderRadius: 12,
        padding: '16px 20px',
        textAlign: 'center',
        flex: 1,
        minWidth: 100,
    });

    return (
        <div className="animate-fadeIn" style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px 80px' }}>
            <div className="page-header">
                <div className="page-header-content">
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FiDatabase /> Diagnostico Offline
                    </h1>
                    <p>Inspecciona y gestiona las operaciones pendientes de sincronizacion con el servidor.</p>
                </div>
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 18px', borderRadius: 12, marginBottom: 24,
                background: isOnline ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: isOnline ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.3)',
                color: isOnline ? '#22c55e' : '#ef4444',
                fontWeight: 600,
            }}>
                {isOnline ? <FiWifi /> : <FiWifiOff />}
                <span>{isOnline ? 'Conectado a internet' : 'Sin conexion a internet'}</span>
            </div>

            {syncResult && (
                <div style={{
                    padding: '12px 18px', borderRadius: 12, marginBottom: 24,
                    background: syncResult.conflicts > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
                    border: syncResult.conflicts > 0 ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(34,197,94,0.3)',
                    color: syncResult.conflicts > 0 ? '#f59e0b' : '#22c55e',
                }}>
                    <strong>Ultimo resultado:</strong>{' '}
                    OK: {syncResult.processed} | Fallidas: {syncResult.failed} | Conflictos: {syncResult.conflicts}
                </div>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                <div style={cardStyle('99,102,241')}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#6366f1' }}>{stats.total}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Total en cola</div>
                </div>
                <div style={cardStyle('245,158,11')}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{stats.pending}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Pendientes</div>
                </div>
                <div style={cardStyle('239,68,68')}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{stats.failed}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Fallidas</div>
                </div>
                <div style={cardStyle('239,68,68')}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{stats.conflict}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Conflictos</div>
                </div>
                <div style={cardStyle('34,197,94')}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{stats.sales}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Ventas en cola</div>
                </div>
            </div>

            {stats.sales > 0 && (
                <div style={{
                    padding: '14px 18px', borderRadius: 12, marginBottom: 24,
                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                    color: '#f59e0b', display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                    <FiAlertTriangle size={20} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                        <strong>Se encontraron {stats.sales} venta(s) sin sincronizar.</strong>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                            Estas ventas fueron registradas offline y aun no se han guardado en la base de datos del servidor.
                            Haz clic en "Sincronizar ahora" para intentar enviarlas.
                        </p>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
                <button
                    className="btn btn-primary"
                    onClick={handleForceSync}
                    disabled={!isOnline || isSyncing || queue.filter(m => m.status === 'pending' || m.status === 'failed').length === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <FiSend size={16} />
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                </button>
                <button
                    className="btn btn-ghost"
                    onClick={() => { loadQueue(); loadOfflineSales(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <FiRefreshCw size={16} /> Recargar
                </button>
                {queue.length > 0 && (
                    <button
                        className="btn btn-ghost"
                        onClick={handleClearAll}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-error)' }}
                    >
                        <FiTrash2 size={16} /> Limpiar cola completa
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                {[
                    { key: 'queue', label: 'Cola de sync (' + queue.length + ')' },
                    { key: 'cache', label: 'Ventas offline en cache (' + offlineSales.length + ')' },
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        style={{
                            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: 13,
                            background: tab === t.key ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                            color: tab === t.key ? '#fff' : 'var(--text-muted)',
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'queue' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {loading ? (
                            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
                        ) : queue.length === 0 ? (
                            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                                <FiCheckCircle size={40} style={{ marginBottom: 12, color: '#22c55e' }} />
                                <p style={{ fontWeight: 600 }}>La cola de sincronizacion esta vacia</p>
                                <p style={{ fontSize: 13 }}>No hay operaciones pendientes.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left' }}>
                                            {['Fecha', 'Endpoint', 'Metodo', 'Estado', 'Reintentos', 'Error', 'Acciones'].map(h => (
                                                <th key={h} style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {queue.map((m, i) => (
                                            <tr key={m.id} style={{
                                                borderBottom: '1px solid var(--border-color)',
                                                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                                            }}>
                                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{formatTS(m.timestamp)}</td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <code style={{ fontSize: 12, color: 'var(--color-primary-400)' }}>{endpointName(m.endpoint)}</code>
                                                </td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <span style={{ color: methodColor(m.method), fontWeight: 700, fontSize: 11 }}>{m.method}</span>
                                                </td>
                                                <td style={{ padding: '10px 14px' }}><Badge status={m.status} /></td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>{m.retries}</td>
                                                <td style={{ padding: '10px 14px', maxWidth: 200, color: '#ef4444', fontSize: 12 }}>
                                                    {m.error ? (
                                                        <span title={m.error} style={{ cursor: 'help' }}>
                                                            {m.error.length > 50 ? m.error.slice(0, 50) + '...' : m.error}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button title="Ver datos" onClick={() => setSelectedMutation(m)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-400)', padding: 4 }}>
                                                            <FiEye size={15} />
                                                        </button>
                                                        {(m.status === 'failed' || m.status === 'conflict') && (
                                                            <button title="Reintentar" onClick={() => handleRetryOne(m.id)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: 4 }}>
                                                                <FiRefreshCw size={15} />
                                                            </button>
                                                        )}
                                                        <button title="Eliminar" onClick={() => handleDeleteOne(m.id)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                                                            <FiTrash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'cache' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {offlineSales.length === 0 ? (
                            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                                <FiCheckCircle size={40} style={{ marginBottom: 12, color: '#22c55e' }} />
                                <p style={{ fontWeight: 600 }}>No hay ventas offline en cache</p>
                                <p style={{ fontSize: 13 }}>Todas las ventas ya estan sincronizadas.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left' }}>
                                            {['ID (temp)', 'Lote', 'Precio', 'Cliente', 'Fecha creacion', 'Estado'].map(h => (
                                                <th key={h} style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {offlineSales.map((s, i) => (
                                            <tr key={s.id} style={{
                                                borderBottom: '1px solid var(--border-color)',
                                                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                                            }}>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(s.id || '').slice(0, 16)}...</code>
                                                </td>
                                                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{s.lot_number || s.lotNumber || '-'}</td>
                                                <td style={{ padding: '10px 14px' }}>{s.sale_price ? formatCurrency(s.sale_price) : '-'}</td>
                                                <td style={{ padding: '10px 14px' }}>{s.client_name || s.clientName || '-'}</td>
                                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{formatTS(s.created_at || s.createdAt)}</td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <span style={{
                                                        background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                                                        padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                                                    }}>Sin sincronizar</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {selectedMutation && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
                }} onClick={() => setSelectedMutation(null)}>
                    <div style={{
                        background: 'var(--bg-secondary)', borderRadius: 16, padding: 28,
                        maxWidth: 700, width: '100%', maxHeight: '80vh', overflowY: 'auto',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0 }}>Datos de la mutacion</h3>
                            <button onClick={() => setSelectedMutation(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                                <FiX size={20} />
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                            {[
                                ['ID', selectedMutation.id],
                                ['Endpoint', selectedMutation.endpoint],
                                ['Metodo', selectedMutation.method],
                                ['Estado', selectedMutation.status],
                                ['Creado', formatTS(selectedMutation.timestamp)],
                                ['Reintentos', selectedMutation.retries],
                                ['Error', selectedMutation.error || '-'],
                            ].map(([label, val]) => (
                                <div key={label} style={{ background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 10 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                                    <div style={{ fontWeight: 600, wordBreak: 'break-all', fontSize: 13 }}>{String(val)}</div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>DATOS ENVIADOS (body)</div>
                            <pre style={{
                                background: 'var(--bg-tertiary)', borderRadius: 10, padding: 16,
                                fontSize: 12, overflowX: 'auto', margin: 0,
                                color: 'var(--color-primary-400)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                            }}>
                                {JSON.stringify(selectedMutation.data, null, 2)}
                            </pre>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                            {(selectedMutation.status === 'failed' || selectedMutation.status === 'conflict') && (
                                <button className="btn btn-primary"
                                    onClick={() => { handleRetryOne(selectedMutation.id); setSelectedMutation(null); }}>
                                    <FiRefreshCw size={14} /> Reintentar
                                </button>
                            )}
                            <button className="btn btn-ghost" onClick={() => setSelectedMutation(null)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
