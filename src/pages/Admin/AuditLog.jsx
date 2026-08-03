import { useState, useEffect, useCallback } from 'react';
import {
    FiShield, FiRefreshCw,
    FiUser, FiEdit2, FiTrash2, FiPlus, FiEye, FiDownload, FiFilter
} from 'react-icons/fi';
import { api } from '../../lib/apiClient';

const ACTION_ICONS = {
    create: <FiPlus style={{ color: '#22c55e' }} />,
    update: <FiEdit2 style={{ color: '#f59e0b' }} />,
    delete: <FiTrash2 style={{ color: '#ef4444' }} />,
    view:   <FiEye   style={{ color: '#6366f1' }} />,
    login:  <FiUser  style={{ color: '#0ea5e9' }} />,
    generate_doc: <FiDownload style={{ color: '#8b5cf6' }} />,
};

const ACTION_LABELS = {
    create: 'Creación',
    update: 'Edición',
    delete: 'Eliminación',
    view:   'Consulta',
    login:  'Acceso',
    generate_doc: 'Documento',
};

const ACTION_COLORS = {
    create: '#dcfce7',
    update: '#fef3c7',
    delete: '#fee2e2',
    view:   '#ede9fe',
    login:  '#e0f2fe',
    generate_doc: '#f3e8ff',
};

function formatDateTime(dt) {
    if (!dt) return '—';
    try {
        return new Date(dt).toLocaleString('es-CO', {
            dateStyle: 'short', timeStyle: 'short'
        });
    } catch { return dt; }
}

function AuditLog() {
    const [logs, setLogs]       = useState([]);
    const [meta, setMeta]       = useState({ total: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);
    const [entities, setEntities] = useState([]);

    const [filters, setFilters] = useState({
        entity:      '',
        action_type: '',
        dateFrom:    '',
        dateTo:      '',
    });

    const fetchLogs = useCallback(async (f) => {
        const currentFilters = f || filters;
        setLoading(true);
        setError(null);
        try {
            const { data, error: apiErr } = await api.get('endpoints/audit_logs.php?limit=200');
            if (apiErr) {
                setError(apiErr);
                return;
            }
            if (data) {
                let filtered = [...data];
                // Client-side filtering
                if (currentFilters.action_type) {
                    filtered = filtered.filter(l => l.action === currentFilters.action_type);
                }
                if (currentFilters.entity) {
                    filtered = filtered.filter(l => l.entity === currentFilters.entity);
                }
                if (currentFilters.dateFrom) {
                    filtered = filtered.filter(l => l.created_at >= currentFilters.dateFrom);
                }
                if (currentFilters.dateTo) {
                    filtered = filtered.filter(l => l.created_at <= currentFilters.dateTo + ' 23:59:59');
                }
                setLogs(filtered);
                setMeta({ total: data.length, filtered: filtered.length });

                // Extract unique entity names for filter dropdown
                const uniqueEntities = [...new Set(data.map(l => l.entity).filter(Boolean))].sort();
                setEntities(uniqueEntities);
            }
        } catch (e) {
            console.error('Audit fetch error:', e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleFilter = (key, value) => {
        const updated = { ...filters, [key]: value };
        setFilters(updated);
        fetchLogs(updated);
    };

    const clearFilters = () => {
        const reset = { entity: '', action_type: '', dateFrom: '', dateTo: '' };
        setFilters(reset);
        fetchLogs(reset);
    };

    const exportCSV = () => {
        const headers = ['Fecha', 'Usuario', 'Acción', 'Entidad', 'ID Entidad', 'Campo', 'Valor anterior', 'Valor nuevo', 'Detalles'];
        const rows = logs.map(l => [
            formatDateTime(l.created_at), l.user_name, l.action, l.entity,
            l.entity_id, l.field_name, l.old_value, l.new_value, l.details
        ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `auditoria_${new Date().toISOString().slice(0,10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    // Count by action type (from current filtered logs)
    const actionCounts = {};
    Object.keys(ACTION_LABELS).forEach(k => { actionCounts[k] = 0; });
    logs.forEach(l => {
        if (actionCounts[l.action] !== undefined) actionCounts[l.action]++;
    });

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FiShield style={{ color: 'var(--color-primary-500)' }} />
                        Auditoría del Sistema
                    </h1>
                    <p>Registro de todas las acciones realizadas por los usuarios</p>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-secondary" onClick={() => fetchLogs()} disabled={loading}>
                        <FiRefreshCw className={loading ? 'spin' : ''} /> Actualizar
                    </button>
                    <button className="btn btn-primary" onClick={exportCSV} disabled={logs.length === 0}>
                        <FiDownload /> Exportar CSV
                    </button>
                </div>
            </div>

            {/* Error display */}
            {error && (
                <div className="card mb-6" style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                    ⚠️ Error cargando auditoría: {error}
                </div>
            )}

            {/* Stats bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                    <div key={key} className="card" style={{ padding: '12px', textAlign: 'center', cursor: 'pointer', borderLeft: `3px solid ${(ACTION_COLORS[key] || '#e5e7eb').replace('f', 'a')}` }}
                        onClick={() => handleFilter('action_type', filters.action_type === key ? '' : key)}>
                        <div style={{ fontSize: '20px', marginBottom: '4px' }}>{ACTION_ICONS[key]}</div>
                        <div style={{ fontWeight: '700', fontSize: '18px' }}>{actionCounts[key] || 0}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</div>
                    </div>
                ))}
                <div className="card" style={{ padding: '12px', textAlign: 'center', borderLeft: '3px solid #6366f1' }}>
                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>📊</div>
                    <div style={{ fontWeight: '700', fontSize: '18px' }}>{meta.total || 0}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total registros</div>
                </div>
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <FiFilter style={{ color: 'var(--text-muted)' }} />

                    <select className="form-select" style={{ width: '160px' }}
                        value={filters.action_type}
                        onChange={e => handleFilter('action_type', e.target.value)}>
                        <option value="">Todas las acciones</option>
                        {Object.entries(ACTION_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>

                    <select className="form-select" style={{ width: '160px' }}
                        value={filters.entity}
                        onChange={e => handleFilter('entity', e.target.value)}>
                        <option value="">Todas las entidades</option>
                        {entities.map(e => (
                            <option key={e} value={e}>{e}</option>
                        ))}
                    </select>

                    <input type="date" className="form-input" style={{ width: '150px' }}
                        value={filters.dateFrom}
                        onChange={e => handleFilter('dateFrom', e.target.value)} />

                    <input type="date" className="form-input" style={{ width: '150px' }}
                        value={filters.dateTo}
                        onChange={e => handleFilter('dateTo', e.target.value)} />

                    {(filters.action_type || filters.entity || filters.dateFrom || filters.dateTo) && (
                        <button className="btn btn-ghost btn-sm" onClick={clearFilters}>✕ Limpiar</button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="card">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <FiRefreshCw className="spin" size={24} />
                        <p style={{ marginTop: '12px' }}>Cargando registros...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><FiShield /></div>
                        <h3>Sin registros de auditoría</h3>
                        <p>Las acciones del sistema aparecerán aquí</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Usuario</th>
                                    <th>Acción</th>
                                    <th>Entidad</th>
                                    <th>Detalle</th>
                                    <th>Valor anterior</th>
                                    <th>Valor nuevo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, i) => (
                                    <tr key={log.id || i}>
                                        <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {formatDateTime(log.created_at)}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--color-primary-600)' }}>
                                                    {(log.user_name || '?')[0].toUpperCase()}
                                                </div>
                                                <span style={{ fontSize: '12px', fontWeight: '500' }}>{log.user_name || '—'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: ACTION_COLORS[log.action] || '#f3f4f6' }}>
                                                {ACTION_ICONS[log.action]}
                                                {ACTION_LABELS[log.action] || log.action}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '12px' }}>
                                            <span style={{ fontWeight: '600' }}>{log.entity || '—'}</span>
                                            {log.entity_id && <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{String(log.entity_id).substring(0, 8)}...</div>}
                                        </td>
                                        <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px' }}>
                                            {log.details || log.field_name || '—'}
                                        </td>
                                        <td style={{ fontSize: '12px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {log.old_value ? (
                                                <span style={{ color: '#dc2626', textDecoration: 'line-through' }}>{log.old_value}</span>
                                            ) : '—'}
                                        </td>
                                        <td style={{ fontSize: '12px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {log.new_value ? (
                                                <span style={{ color: '#16a34a', fontWeight: '600' }}>{log.new_value}</span>
                                            ) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

export default AuditLog;
