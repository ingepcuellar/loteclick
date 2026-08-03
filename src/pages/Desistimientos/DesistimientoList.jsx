import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    FiAlertTriangle,
    FiCalendar,
    FiDollarSign,
    FiTrash2,
    FiFolder,
    FiUser,
    FiSearch,
    FiDownload
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../lib/formatters';
import ConfirmModal from '../../components/ui/ConfirmModal';

function DesistimientoList() {
    const { state, updateDesistimiento, deleteDesistimiento } = useApp();
    const { isAdmin } = useAuth();

    const [editTarget, setEditTarget] = useState(null);
    const [isProcessingEdit, setIsProcessingEdit] = useState(false);

    const [search, setSearch] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [dateFrom, setDateFrom] = useState(''); // Ítem 19
    const [dateTo, setDateTo] = useState('');     // Ítem 19
    const [deleteTarget, setDeleteTarget] = useState(null);

    const desistimientos = state.desistimientos || [];

    // Filtrar
    const filtered = desistimientos.filter(d => {
        const matchesProject = !projectFilter || d.project_id === projectFilter;
        const matchesSearch = !search ||
            d.client_name?.toLowerCase().includes(search.toLowerCase()) ||
            d.project_name?.toLowerCase().includes(search.toLowerCase()) ||
            String(d.lot_number).includes(search) ||
            d.client_document?.includes(search);
        // Ítem 19: filtro por rango de fechas
        const dDate = (d.desistimiento_date || d.created_at || '').substring(0, 10);
        const matchesFrom = !dateFrom || dDate >= dateFrom;
        const matchesTo   = !dateTo   || dDate <= dateTo;
        return matchesProject && matchesSearch && matchesFrom && matchesTo;
    });

    // Totales
    const totalRetained = filtered.reduce((sum, d) => sum + parseFloat(d.amount_retained || 0), 0);
    const totalPaidByClients = filtered.reduce((sum, d) => sum + parseFloat(d.total_paid || 0), 0);
    const totalRefund = filtered.reduce((sum, d) => {
        const refund = parseFloat(d.refund_amount || 0) || Math.max(0, parseFloat(d.total_paid || 0) - parseFloat(d.amount_retained || 0));
        return sum + refund;
    }, 0);

    // Proyectos únicos para filtro
    const uniqueProjects = [...new Map(desistimientos.map(d => [d.project_id, { id: d.project_id, name: d.project_name }])).values()];

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteDesistimiento(deleteTarget);
        setDeleteTarget(null);
    };

    const handleOpenEdit = (d) => {
        setEditTarget({
            id: d.id,
            amount_retained: d.amount_retained,
            desistimiento_date: d.desistimiento_date || d.created_at.split(' ')[0],
            reason: d.reason || '',
            notes: d.notes || ''
        });
    };

    const handleConfirmEdit = async () => {
        if (!editTarget) return;
        setIsProcessingEdit(true);
        try {
            await updateDesistimiento(editTarget.id, {
                amount_retained: editTarget.amount_retained,
                desistimiento_date: editTarget.desistimiento_date,
                reason: editTarget.reason,
                notes: editTarget.notes
            });
            setEditTarget(null);
        } catch (err) {
            console.error(err);
            alert('Error al editar el desistimiento');
        } finally {
            setIsProcessingEdit(false);
        }
    };

    // Export CSV
    const exportCSV = () => {
        const csv = 'Fecha,Proyecto,Lote,Cliente,Documento,Precio Venta,Total Pagado,Monto Retenido,Monto a Devolver,Motivo\n' +
            filtered.map(d => {
                const refund = parseFloat(d.refund_amount || 0) || Math.max(0, parseFloat(d.total_paid || 0) - parseFloat(d.amount_retained || 0));
                return `${formatDate(d.desistimiento_date || d.created_at)},"${d.project_name || ''}",${d.lot_number},"${d.client_name || ''}","${d.client_document || ''}",${d.sale_price},${d.total_paid},${d.amount_retained},${refund},"${(d.reason || '').replace(/"/g, '""')}"`;
            }).join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `desistimientos_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FiAlertTriangle style={{ color: '#f59e0b' }} />
                        Desistimientos
                    </h1>
                    <p>Registro de ventas canceladas con dinero retenido</p>
                </div>
                <div className="page-header-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={exportCSV}
                        disabled={filtered.length === 0}
                    >
                        <FiDownload /> Exportar CSV
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--spacing-4)',
                marginBottom: 'var(--spacing-6)'
            }}>
                {/* Total desistimientos */}
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                            <FiAlertTriangle />
                        </div>
                        <div className="stat-content">
                            <h3>{filtered.length}</h3>
                            <p>Desistimientos</p>
                        </div>
                    </div>
                </div>

                {/* Total pagado por clientes */}
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                            <FiDollarSign />
                        </div>
                        <div className="stat-content">
                            <h3>{formatCurrency(totalPaidByClients)}</h3>
                            <p>Total Recibido de Clientes</p>
                        </div>
                    </div>
                </div>

                {/* Total retenido */}
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                            <FiDollarSign />
                        </div>
                        <div className="stat-content">
                            <h3 style={{ color: 'var(--color-success)' }}>{formatCurrency(totalRetained)}</h3>
                            <p>Total Retenido (Ingresos)</p>
                        </div>
                    </div>
                </div>

                {/* Total a devolver */}
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                            <FiDollarSign />
                        </div>
                        <div className="stat-content">
                            <h3 style={{ color: '#ef4444' }}>{formatCurrency(totalRefund)}</h3>
                            <p>Total Devuelto a Clientes</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="card-body" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: '1', minWidth: '200px' }}>
                        <label className="form-label">Buscar</label>
                        <div style={{ position: 'relative' }}>
                            <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Cliente, lote, documento..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ paddingLeft: '34px' }}
                            />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, flex: '1', minWidth: '180px' }}>
                        <label className="form-label">Proyecto</label>
                        <select
                            className="form-select"
                            value={projectFilter}
                            onChange={e => setProjectFilter(e.target.value)}
                        >
                            <option value="">Todos los proyectos</option>
                            {uniqueProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    {/* Ítem 19: filtros de fecha */}
                    <div className="form-group" style={{ marginBottom: 0, minWidth: '140px' }}>
                        <label className="form-label">Desde</label>
                        <input
                            type="date"
                            className="form-input"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, minWidth: '140px' }}>
                        <label className="form-label">Hasta</label>
                        <input
                            type="date"
                            className="form-input"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                        />
                    </div>
                    {(search || projectFilter || dateFrom || dateTo) && (
                        <button className="btn btn-ghost" onClick={() => { setSearch(''); setProjectFilter(''); setDateFrom(''); setDateTo(''); }}>
                            Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiAlertTriangle className="card-title-icon" style={{ color: '#f59e0b' }} />
                        Registro de Desistimientos
                    </h3>
                    <span className="badge badge-warning">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="card-body">
                    {filtered.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--spacing-10)' }}>
                            <div className="empty-state-icon">
                                <FiAlertTriangle />
                            </div>
                            <h3>Sin desistimientos registrados</h3>
                            <p>
                                {search || projectFilter
                                    ? 'No hay resultados para los filtros aplicados'
                                    : 'Cuando un cliente desista de una compra, aparecerá aquí'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Proyecto</th>
                                        <th>Lote</th>
                                        <th>Cliente</th>
                                        <th style={{ textAlign: 'right' }}>Precio Venta</th>
                                        <th style={{ textAlign: 'right' }}>Total Pagado</th>
                                        <th style={{ textAlign: 'right' }}>Retenido</th>
                                        <th style={{ textAlign: 'right' }}>A Devolver</th>
                                        <th>Motivo</th>
                                        {isAdmin() && <th></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(d => (
                                        <tr key={d.id}>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                <FiCalendar size={12} style={{ marginRight: '4px', color: 'var(--text-muted)' }} />
                                                {formatDate(d.desistimiento_date || d.created_at)}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <FiFolder size={13} style={{ color: 'var(--color-primary-400)', flexShrink: 0 }} />
                                                    <span style={{ fontWeight: '500' }}>{d.project_name || '-'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge badge-info">#{d.lot_number}</span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <FiUser size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                    <div>
                                                        <div style={{ fontWeight: '500' }}>{d.client_name || '-'}</div>
                                                        {d.client_document && (
                                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                                                {d.client_document}
                                                            </div>
                                                        )}
                                                        {d.client_phone && (
                                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                                                📞 {d.client_phone}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                                {formatCurrency(d.sale_price)}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {formatCurrency(d.total_paid)}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span style={{
                                                    fontWeight: '700',
                                                    color: 'var(--color-success)',
                                                    background: 'rgba(16, 185, 129, 0.1)',
                                                    padding: '2px 8px',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontSize: 'var(--font-size-sm)'
                                                }}>
                                                    {formatCurrency(d.amount_retained)}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {(() => {
                                                    const refund = parseFloat(d.refund_amount || 0) || Math.max(0, parseFloat(d.total_paid || 0) - parseFloat(d.amount_retained || 0));
                                                    return refund > 0 ? (
                                                        <span style={{
                                                            fontWeight: '700',
                                                            color: '#ef4444',
                                                            background: 'rgba(239,68,68,0.1)',
                                                            padding: '2px 8px',
                                                            borderRadius: 'var(--radius-md)',
                                                            fontSize: 'var(--font-size-sm)'
                                                        }}>
                                                            {formatCurrency(refund)}
                                                        </span>
                                                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>—</span>;
                                                })()}
                                            </td>
                                            <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                                                {d.reason || '-'}
                                            </td>
                                            {isAdmin() && (
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => handleOpenEdit(d)}
                                                            style={{ color: '#f59e0b' }}
                                                            title="Editar registro"
                                                        >
                                                            <FiAlertTriangle size={14} style={{ display: 'none' }} /> {/* To keep import active if needed, actually let's just use text or another icon, wait I have FiAlertTriangle */}
                                                            Editar
                                                        </button>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => setDeleteTarget(d.id)}
                                                            style={{ color: '#ef4444' }}
                                                            title="Eliminar registro"
                                                        >
                                                            <FiTrash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                                {/* Footer totals */}
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: '700' }}>
                                        <td colSpan={4}>Total ({filtered.length})</td>
                                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                            {formatCurrency(filtered.reduce((s, d) => s + parseFloat(d.sale_price || 0), 0))}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {formatCurrency(totalPaidByClients)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>
                                            {formatCurrency(totalRetained)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#ef4444' }}>
                                            {formatCurrency(totalRefund)}
                                        </td>
                                        <td colSpan={isAdmin() ? 2 : 1}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={!!deleteTarget}
                title="¿Eliminar registro de desistimiento?"
                message="Solo se elimina el registro histórico. La venta ya fue eliminada anteriormente y no se puede restaurar."
                confirmText="Eliminar registro"
                variant="danger"
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />

            {/* Modal Editar Desistimiento */}
            {editTarget && (
                <div className="modal-overlay" onClick={() => !isProcessingEdit && setEditTarget(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Editar Desistimiento</h3>
                            <button className="modal-close" onClick={() => setEditTarget(null)} disabled={isProcessingEdit}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Monto Retenido</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={editTarget.amount_retained}
                                    onChange={e => setEditTarget(prev => ({ ...prev, amount_retained: e.target.value }))}
                                    required
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Fecha del Desistimiento</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={editTarget.desistimiento_date}
                                    onChange={e => setEditTarget(prev => ({ ...prev, desistimiento_date: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Motivo</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={editTarget.reason}
                                    onChange={e => setEditTarget(prev => ({ ...prev, reason: e.target.value }))}
                                />
                            </div>
                            <div className="form-group mb-0">
                                <label className="form-label">Notas Adicionales</label>
                                <textarea
                                    className="form-control"
                                    rows="2"
                                    value={editTarget.notes}
                                    onChange={e => setEditTarget(prev => ({ ...prev, notes: e.target.value }))}
                                ></textarea>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setEditTarget(null)}
                                disabled={isProcessingEdit}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
                                onClick={handleConfirmEdit}
                                disabled={isProcessingEdit}
                            >
                                {isProcessingEdit ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DesistimientoList;
