import { useState, useEffect, useCallback } from 'react';
import {
    FiPlus, FiRefreshCw, FiCheck, FiClock, FiSearch,
    FiFilter, FiCalendar, FiDollarSign, FiTrendingUp,
    FiTrendingDown, FiLink, FiTrash2, FiX, FiInfo,
    FiCreditCard, FiGitMerge, FiAlertCircle
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { bankReconciliationService } from '../../services/bankReconciliationService';
import { formatCurrency, formatDate, todayBogota } from '../../lib/formatters';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const currentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ─── Modal: Nuevo Movimiento ──────────────────────────────────────────────────
function MovementModal({ accounts, projects, onSave, onClose }) {
    const [form, setForm] = useState({
        fecha: todayBogota(),
        concepto: '',
        valor: '',
        tipo: 'credito',
        project_id: '',
        bank_account_id: '',
        notas: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.fecha || !form.concepto || !form.valor) {
            setError('Fecha, concepto y valor son obligatorios.');
            return;
        }
        setSaving(true);
        const { data, error: err } = await bankReconciliationService.create(form);
        setSaving(false);
        if (err) { setError(err); return; }
        onSave(data);
    };

    return (
        <div style={overlay}>
            <div style={modalBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FiPlus /> Nuevo Movimiento Bancario
                    </h3>
                    <button onClick={onClose} className="btn btn-ghost btn-sm"><FiX /></button>
                </div>

                {error && (
                    <div className="alert alert-error" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Tipo */}
                    <div className="form-group">
                        <label className="form-label">Tipo *</label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {['credito', 'debito'].map(t => (
                                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: '8px', border: `2px solid ${form.tipo === t ? (t === 'credito' ? '#10b981' : '#ef4444') : 'var(--border-color)'}`, background: form.tipo === t ? (t === 'credito' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') : 'transparent', flex: 1, justifyContent: 'center' }}>
                                    <input type="radio" value={t} checked={form.tipo === t} onChange={() => set('tipo', t)} style={{ display: 'none' }} />
                                    {t === 'credito' ? <FiTrendingUp color="#10b981" /> : <FiTrendingDown color="#ef4444" />}
                                    <span style={{ fontWeight: 600, color: t === 'credito' ? '#10b981' : '#ef4444' }}>
                                        {t === 'credito' ? 'Crédito (Entrada)' : 'Débito (Salida)'}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Fecha + Valor */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label"><FiCalendar /> Fecha *</label>
                            <input type="date" className="form-control" value={form.fecha} onChange={e => set('fecha', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label"><FiDollarSign /> Valor *</label>
                            <input type="number" className="form-control" placeholder="0" min="0" step="1000"
                                value={form.valor} onChange={e => set('valor', e.target.value)} required />
                        </div>
                    </div>

                    {/* Concepto */}
                    <div className="form-group">
                        <label className="form-label">Concepto *</label>
                        <input type="text" className="form-control" placeholder="Descripción del movimiento..."
                            value={form.concepto} onChange={e => set('concepto', e.target.value)} required />
                    </div>

                    {/* Proyecto + Cuenta */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">Proyecto</label>
                            <select className="form-select" value={form.project_id} onChange={e => set('project_id', e.target.value)}>
                                <option value="">Sin proyecto</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Cuenta Bancaria</label>
                            <select className="form-select" value={form.bank_account_id} onChange={e => set('bank_account_id', e.target.value)}>
                                <option value="">Sin cuenta</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} — {a.account_number}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Notas */}
                    <div className="form-group">
                        <label className="form-label">Notas</label>
                        <textarea className="form-control" rows={2} placeholder="Observaciones..."
                            value={form.notas} onChange={e => set('notas', e.target.value)} />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Guardando...' : <><FiPlus /> Registrar Movimiento</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Modal: Conciliar Movimiento ──────────────────────────────────────────────
function ReconcileModal({ movement, onReconcile, onClose }) {
    const [selectedPago, setSelectedPago]   = useState(null);
    const [selectedGasto, setSelectedGasto] = useState(null);
    const [saving, setSaving] = useState(false);

    const suggestions = movement.suggestions || {};
    const pagos  = suggestions.pagos  || [];
    const gastos = suggestions.gastos || [];

    const handleReconcile = async (pagoId = null, gastoId = null) => {
        setSaving(true);
        const { data, error } = await bankReconciliationService.reconcile(movement.id, { pagoId, gastoId });
        setSaving(false);
        if (!error && data) onReconcile(data);
    };

    const esCred = movement.tipo === 'credito';

    return (
        <div style={overlay}>
            <div style={{ ...modalBox, maxWidth: '640px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FiGitMerge /> Conciliar Movimiento
                    </h3>
                    <button onClick={onClose} className="btn btn-ghost btn-sm"><FiX /></button>
                </div>

                {/* Resumen del movimiento */}
                <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-tertiary)', marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Concepto</div>
                        <div style={{ fontWeight: 600 }}>{movement.concepto}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fecha</div>
                        <div>{formatDate(movement.fecha)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Valor</div>
                        <div style={{ fontWeight: 700, color: esCred ? '#10b981' : '#ef4444', fontSize: '1.1rem' }}>
                            {esCred ? '+' : '-'}{formatCurrency(movement.valor)}
                        </div>
                    </div>
                </div>

                {/* Sugerencias */}
                {esCred && pagos.length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: '#10b981' }}>
                            💰 Pagos del sistema que podrían coincidir:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {pagos.map(p => (
                                <div key={p.id} onClick={() => setSelectedPago(p.id === selectedPago ? null : p.id)}
                                    style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: `2px solid ${selectedPago === p.id ? '#10b981' : 'var(--border-color)'}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: selectedPago === p.id ? 'rgba(16,185,129,0.07)' : 'transparent' }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{p.client_name || 'Cliente'}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(p.payment_date || p.created_at)}</div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(p.amount)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!esCred && gastos.length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: '#ef4444' }}>
                            💸 Gastos del sistema que podrían coincidir:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {gastos.map(g => (
                                <div key={g.id} onClick={() => setSelectedGasto(g.id === selectedGasto ? null : g.id)}
                                    style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: `2px solid ${selectedGasto === g.id ? '#ef4444' : 'var(--border-color)'}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: selectedGasto === g.id ? 'rgba(239,68,68,0.07)' : 'transparent' }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{g.description || 'Gasto'}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(g.created_at)}</div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: '#ef4444' }}>{formatCurrency(g.amount)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {pagos.length === 0 && gastos.length === 0 && (
                    <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                        <FiInfo /> No se encontraron registros coincidentes en el sistema.
                    </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
                    <button onClick={() => handleReconcile(null, null)} className="btn btn-outline" disabled={saving}>
                        Marcar sin vincular
                    </button>
                    <button
                        onClick={() => handleReconcile(selectedPago, selectedGasto)}
                        className="btn btn-primary"
                        disabled={saving || (!selectedPago && !selectedGasto && (pagos.length > 0 || gastos.length > 0))}
                    >
                        <FiLink /> {saving ? 'Conciliando...' : 'Conciliar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
function BankReconciliation() {
    const { state } = useApp();
    const projects  = state.projects || [];

    const [movements,   setMovements]   = useState([]);
    const [accounts,    setAccounts]    = useState([]);
    const [summary,     setSummary]     = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [month,       setMonth]       = useState(currentMonth());
    const [projectId,   setProjectId]   = useState('');
    const [accountId,   setAccountId]   = useState('');
    const [searchTerm,  setSearchTerm]  = useState('');
    const [filterTipo,  setFilterTipo]  = useState('');
    const [showPending, setShowPending] = useState(false);
    const [showModal,   setShowModal]   = useState(false);
    const [reconciling, setReconciling] = useState(null); // movement being reconciled

    const load = useCallback(async () => {
        setLoading(true);
        const [movRes, accRes, sumRes] = await Promise.all([
            bankReconciliationService.getAll({ projectId, accountId, month, tipo: filterTipo }),
            bankReconciliationService.getAccounts(projectId),
            bankReconciliationService.getSummary(projectId, month),
        ]);
        if (!movRes.error && movRes.data) setMovements(movRes.data);
        if (!accRes.error && accRes.data) setAccounts(accRes.data);
        if (!sumRes.error && sumRes.data) setSummary(sumRes.data);
        setLoading(false);
    }, [projectId, accountId, month, filterTipo]);

    useEffect(() => { load(); }, [load]);

    // Filtro de búsqueda + pendientes en cliente
    const filtered = movements.filter(m => {
        if (showPending && m.conciliado) return false;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            if (!m.concepto?.toLowerCase().includes(q) &&
                !m.project_name?.toLowerCase().includes(q) &&
                !m.bank_name?.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const handleSave = (newMov) => {
        setMovements(prev => [newMov, ...prev]);
        setShowModal(false);
        load(); // reload summary
    };

    const handleReconciled = (updated) => {
        setMovements(prev => prev.map(m => m.id === updated.id ? updated : m));
        setReconciling(null);
        load(); // reload summary
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este movimiento?')) return;
        const { error } = await bankReconciliationService.delete(id);
        if (!error) {
            setMovements(prev => prev.filter(m => m.id !== id));
            load();
        }
    };

    const banco   = summary?.banco   || {};
    const sistema = summary?.sistema || {};
    const diffs   = summary?.diferencias || {};

    return (
        <div className="page-container">
            {/* ── Header ── */}
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
                        <FiGitMerge style={{ color: 'var(--primary)' }} />
                        Conciliación Bancaria
                    </h1>
                    <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Compara los movimientos del banco con los registros del sistema
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <FiPlus /> Nuevo Movimiento
                </button>
            </div>

            {/* ── Filtros ── */}
            <div className="card mb-6" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {/* Mes */}
                    <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}><FiCalendar /> Mes</label>
                        <input type="month" className="form-control" value={month} onChange={e => setMonth(e.target.value)} />
                    </div>
                    {/* Proyecto */}
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '180px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Proyecto</label>
                        <select className="form-select" value={projectId} onChange={e => { setProjectId(e.target.value); setAccountId(''); }}>
                            <option value="">Todos los proyectos</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    {/* Cuenta */}
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '180px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Cuenta Bancaria</label>
                        <select className="form-select" value={accountId} onChange={e => setAccountId(e.target.value)}>
                            <option value="">Todas las cuentas</option>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} — {a.account_number}</option>)}
                        </select>
                    </div>
                    {/* Tipo */}
                    <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Tipo</label>
                        <select className="form-select" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
                            <option value="">Todos</option>
                            <option value="credito">💰 Créditos</option>
                            <option value="debito">💸 Débitos</option>
                        </select>
                    </div>
                    {/* Buscar */}
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '180px', position: 'relative' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}><FiSearch /> Buscar</label>
                        <input className="form-control" placeholder="Concepto, banco, proyecto..."
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    {/* Toggle pendientes */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                        <button className={`btn ${showPending ? 'btn-warning' : 'btn-secondary'}`}
                            onClick={() => setShowPending(p => !p)} title="Mostrar solo pendientes">
                            <FiFilter /> {showPending ? 'Pendientes' : 'Todos'}
                        </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                        <button className="btn btn-secondary" onClick={load} title="Recargar">
                            <FiRefreshCw />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="card stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}><FiTrendingUp /></div>
                        <div className="stat-content">
                            <h3>{formatCurrency(banco.total_creditos || 0)}</h3>
                            <p>Créditos Banco</p>
                        </div>
                    </div>
                    <div className="card stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}><FiTrendingDown /></div>
                        <div className="stat-content">
                            <h3>{formatCurrency(banco.total_debitos || 0)}</h3>
                            <p>Débitos Banco</p>
                        </div>
                    </div>
                    <div className="card stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}><FiCreditCard /></div>
                        <div className="stat-content">
                            <h3>{formatCurrency((banco.total_creditos || 0) - (banco.total_debitos || 0))}</h3>
                            <p>Saldo Banco</p>
                        </div>
                    </div>
                    <div className="card stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}><FiClock /></div>
                        <div className="stat-content">
                            <h3>{banco.pendientes || 0}</h3>
                            <p>Pendientes</p>
                        </div>
                    </div>
                    <div className="card stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}><FiCheck /></div>
                        <div className="stat-content">
                            <h3>{banco.conciliados || 0}</h3>
                            <p>Conciliados</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Tabla de Movimientos ── */}
            <div className="card mb-6">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiDollarSign className="card-title-icon" />
                        Movimientos Bancarios
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                            ({filtered.length} registros)
                        </span>
                    </h3>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                            Cargando movimientos...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <FiGitMerge size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 1rem' }} />
                            No hay movimientos bancarios para este período.
                            <br />
                            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowModal(true)}>
                                <FiPlus /> Registrar primer movimiento
                            </button>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Concepto</th>
                                        <th>Proyecto</th>
                                        <th>Cuenta</th>
                                        <th style={{ textAlign: 'center' }}>Tipo</th>
                                        <th style={{ textAlign: 'right' }}>Valor</th>
                                        <th style={{ textAlign: 'center' }}>Estado</th>
                                        <th style={{ textAlign: 'center' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(m => (
                                        <tr key={m.id} style={{ background: m.conciliado ? 'rgba(16,185,129,0.03)' : undefined }}>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                <FiCalendar style={{ marginRight: '0.4rem', opacity: 0.5 }} />
                                                {formatDate(m.fecha)}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{m.concepto}</div>
                                                {m.notas && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.notas}</div>}
                                                {m.linked_payment && (
                                                    <div style={{ fontSize: '0.75rem', color: '#10b981' }}>
                                                        🔗 {m.linked_payment.client_name} — {formatCurrency(m.linked_payment.amount)}
                                                    </div>
                                                )}
                                                {m.linked_expense && (
                                                    <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                                                        🔗 {m.linked_expense.description} — {formatCurrency(m.linked_expense.amount)}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{m.project_name || '—'}</td>
                                            <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                {m.bank_name ? `${m.bank_name}` : '—'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {m.tipo === 'credito'
                                                    ? <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}><FiTrendingUp /> Crédito</span>
                                                    : <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}><FiTrendingDown /> Débito</span>
                                                }
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: m.tipo === 'credito' ? '#10b981' : '#ef4444' }}>
                                                {m.tipo === 'credito' ? '+' : '-'}{formatCurrency(m.valor)}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {m.conciliado
                                                    ? <span className="badge badge-success"><FiCheck size={11} /> Conciliado</span>
                                                    : <span className="badge badge-warning"><FiClock size={11} /> Pendiente</span>
                                                }
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                                    {!m.conciliado && (
                                                        <button
                                                            className="btn btn-sm btn-primary"
                                                            onClick={() => setReconciling(m)}
                                                            title="Conciliar"
                                                        >
                                                            <FiLink /> Conciliar
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleDelete(m.id)}
                                                        title="Eliminar"
                                                    >
                                                        <FiTrash2 />
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

            {/* ── Panel de Diferencias: Sistema vs Banco ── */}
            {summary && (
                <div className="card mb-6">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiAlertCircle className="card-title-icon" />
                            Comparativo Sistema vs Banco — {month}
                        </h3>
                    </div>
                    <div className="card-body">
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Concepto</th>
                                        <th style={{ textAlign: 'right', color: '#6366f1' }}>Sistema</th>
                                        <th style={{ textAlign: 'right', color: '#f59e0b' }}>Banco</th>
                                        <th style={{ textAlign: 'right' }}>Diferencia</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>💰 Ingresos / Créditos</td>
                                        <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                                            {formatCurrency(sistema.total_pagos || 0)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                                            {formatCurrency(banco.total_creditos || 0)}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                            <span style={{ color: Math.abs(diffs.creditos || 0) < 1000 ? '#10b981' : '#f59e0b' }}>
                                                {diffs.creditos >= 0 ? '+' : ''}{formatCurrency(diffs.creditos || 0)}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>💸 Gastos / Débitos</td>
                                        <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>
                                            {formatCurrency(sistema.total_gastos || 0)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>
                                            {formatCurrency(banco.total_debitos || 0)}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                            <span style={{ color: Math.abs(diffs.debitos || 0) < 1000 ? '#10b981' : '#f59e0b' }}>
                                                {diffs.debitos >= 0 ? '+' : ''}{formatCurrency(diffs.debitos || 0)}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                                        <td>📊 Saldo Neto</td>
                                        <td style={{ textAlign: 'right', color: 'var(--primary)', fontSize: '1.05em' }}>
                                            {formatCurrency(sistema.saldo || 0)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--primary)', fontSize: '1.05em' }}>
                                            {formatCurrency(banco.saldo || 0)}
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: '1.05em' }}>
                                            <span style={{ color: Math.abs((banco.saldo || 0) - (sistema.saldo || 0)) < 1000 ? '#10b981' : '#ef4444' }}>
                                                {formatCurrency((banco.saldo || 0) - (sistema.saldo || 0))}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Progreso de conciliación */}
                        {(banco.total_movimientos || 0) > 0 && (
                            <div style={{ marginTop: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    <span>Progreso de conciliación</span>
                                    <span style={{ fontWeight: 600 }}>
                                        {banco.conciliados || 0} / {banco.total_movimientos || 0} movimientos
                                    </span>
                                </div>
                                <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '999px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${Math.round(((banco.conciliados || 0) / (banco.total_movimientos || 1)) * 100)}%`,
                                        background: 'linear-gradient(90deg, #10b981, #059669)',
                                        borderRadius: '999px',
                                        transition: 'width 0.5s ease'
                                    }} />
                                </div>
                                <div style={{ textAlign: 'right', fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                                    {Math.round(((banco.conciliados || 0) / (banco.total_movimientos || 1)) * 100)}% conciliado
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Modales ── */}
            {showModal && (
                <MovementModal
                    accounts={accounts}
                    projects={projects}
                    onSave={handleSave}
                    onClose={() => setShowModal(false)}
                />
            )}
            {reconciling && (
                <ReconcileModal
                    movement={reconciling}
                    onReconcile={handleReconciled}
                    onClose={() => setReconciling(null)}
                />
            )}
        </div>
    );
}

export default BankReconciliation;

// ─── Estilos compartidos ──────────────────────────────────────────────────────
const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)',
};
const modalBox = {
    background: 'var(--bg-secondary)', borderRadius: '16px',
    padding: '1.75rem', width: '100%', maxWidth: '560px',
    maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
};
