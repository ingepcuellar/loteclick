import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    FiPlus,
    FiDollarSign,
    FiSearch,
    FiCalendar,
    FiFilter,
    FiEye,
    FiImage,
    FiCreditCard
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { resolveImageUrl } from '../../lib/barcodeUtils';


function PaymentList() {
    const { state, getSaleById, getClientById, getProjectById } = useApp();
    const { isPartner, isAdmin, currentUser } = useAuth();
    // Filtrar proyectos del socio
    const partnerProjectIds = currentUser?.associated_projects || currentUser?.associatedProjects || [];
    const isRestrictedPartner = isPartner() && !isAdmin();
    const visibleProjectIds = isRestrictedPartner && partnerProjectIds.length > 0
        ? partnerProjectIds.map(String)
        : null; // null = sin restricción
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterMethod, setFilterMethod] = useState('');  // Fix: was used but never declared

    // Sort payments by date (newest first)
    const sortedPayments = [...state.payments].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const filteredPayments = sortedPayments.filter(payment => {
        const sale = getSaleById(payment.saleId || payment.sale_id);
        const client = sale ? getClientById(sale.clientId || sale.client_id) : null;
        const project = sale ? getProjectById(sale.projectId || sale.project_id) : null;
        const lotNumber = String(sale?.lotNumber || sale?.lot_number || '');
        const saleProjectId = String(sale?.projectId || sale?.project_id || '');

        // Filtro por rol: socios solo ven pagos de sus proyectos
        if (visibleProjectIds && !visibleProjectIds.includes(saleProjectId)) return false;

        const matchesSearch = !searchTerm ||
            (client?.name || client?.fullName)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client?.document || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lotNumber.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesProject = !filterProject || (sale?.projectId || sale?.project_id) === filterProject;

        const matchesMethod = !filterMethod ||
            (payment.paymentMethod || payment.payment_method || 'cash') === filterMethod;

        return matchesSearch && matchesProject && matchesMethod;
    });

    // Para el dropdown: solo proyectos del socio
    const visibleProjects = isRestrictedPartner
        ? state.projects.filter(p => (visibleProjectIds || []).includes(String(p.id)))
        : state.projects;

    // Calculate totals
    const totalPayments = filteredPayments.reduce(
        (sum, p) => sum + parseFloat(p.amount || 0), 0
    );
    const totalCash = filteredPayments
        .filter(p => (p.paymentMethod || p.payment_method || 'cash') === 'cash')
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const totalTransfer = filteredPayments
        .filter(p => (p.paymentMethod || p.payment_method) === 'transfer')
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <h1>Pagos</h1>
                    <p>Historial y registro de pagos</p>
                </div>
                <div className="page-header-actions">
                    <Link to="/payments/new" className="btn btn-primary">
                        <FiPlus />
                        Registrar Pago
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="grid mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon primary"><FiDollarSign /></div>
                        <div className="stat-content">
                            <h3>{filteredPayments.length}</h3>
                            <p>Total Pagos</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon accent"><FiDollarSign /></div>
                        <div className="stat-content">
                            <h3>{formatCurrency(totalPayments)}</h3>
                            <p>Total Recaudado</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a' }}>
                            <span style={{ fontSize: '1.2rem' }}>💵</span>
                        </div>
                        <div className="stat-content">
                            <h3>{formatCurrency(totalCash)}</h3>
                            <p>Efectivo</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon info"><FiCreditCard /></div>
                        <div className="stat-content">
                            <h3>{formatCurrency(totalTransfer)}</h3>
                            <p>Transferencia</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                            <FiCalendar />
                        </div>
                        <div className="stat-content">
                            <h3>
                                {filteredPayments.length > 0
                                    ? formatDate(filteredPayments[0].createdAt)
                                    : '-'
                                }
                            </h3>
                            <p>Último Pago</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                        <FiSearch style={{
                            position: 'absolute',
                            left: 'var(--spacing-4)',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)'
                        }} />
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Buscar por cliente, cédula, lote o proyecto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: 'var(--spacing-10)' }}
                        />
                    </div>

                    <select
                        className="form-select"
                        value={filterProject}
                        onChange={(e) => setFilterProject(e.target.value)}
                        style={{ width: '200px' }}
                    >
                        <option value="">Todos los proyectos</option>
                        {visibleProjects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

                    <select
                        className="form-select"
                        value={filterMethod}
                        onChange={(e) => setFilterMethod(e.target.value)}
                        style={{ width: '180px' }}
                    >
                        <option value="">💰 Todos los métodos</option>
                        <option value="cash">💵 Efectivo</option>
                        <option value="transfer">🏦 Transferencia</option>
                        <option value="permuta">🔄 Permuta</option>
                    </select>
                </div>
            </div>

            {/* Payments Table */}
            {state.payments.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <FiDollarSign />
                        </div>
                        <h3>No hay pagos</h3>
                        <p>Registra tu primer pago</p>
                        <Link to="/payments/new" className="btn btn-primary">
                            <FiPlus />
                            Registrar Pago
                        </Link>
                    </div>
                </div>
            ) : filteredPayments.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <FiFilter />
                        </div>
                        <h3>Sin resultados</h3>
                        <p>No se encontraron pagos con los filtros aplicados</p>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Cliente</th>
                                    <th>Proyecto / Lote</th>
                                    <th>Monto</th>
                                    <th>Método</th>
                                    <th>Recibo</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPayments.map(payment => {
                                    const sale = getSaleById(payment.saleId);
                                    const client = sale ? getClientById(sale.clientId) : null;
                                    const project = sale ? getProjectById(sale.projectId) : null;

                                    return (
                                        <tr key={payment.id}>
                                            <td>
                                                <div className="flex gap-1" style={{ alignItems: 'center' }}>
                                                    <FiCalendar size={12} />
                                                    {formatDate(payment.paymentDate || payment.createdAt)}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex gap-2" style={{ alignItems: 'center' }}>
                                                    <div style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-accent-500))',
                                                        borderRadius: 'var(--radius-md)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        fontWeight: '600',
                                                        fontSize: 'var(--font-size-sm)'
                                                    }}>
                                                        {(client?.name || client?.fullName)?.charAt(0).toUpperCase() || '?'}
                                                    </div>
                                                    <span>{client?.name || client?.fullName || '-'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div>
                                                    <div style={{ fontWeight: '500' }}>{project?.name || '-'}</div>
                                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                                        Lote {sale?.lotNumber || '-'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: '600', color: 'var(--color-success)' }}>
                                                {formatCurrency(payment.amount)}
                                            </td>
                                            <td>
                                                {(() => {
                                                    const method = payment.paymentMethod || payment.payment_method || 'cash';
                                                    if (method === 'transfer') return (
                                                        <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>🏦 Transferencia</span>
                                                    );
                                                    if (method === 'permuta' || method === 'barter') return (
                                                        <span className="badge" style={{ fontSize: 'var(--font-size-xs)', background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>🔄 Permuta</span>
                                                    );
                                                    return (
                                                        <span className="badge" style={{ fontSize: 'var(--font-size-xs)', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', border: '1px solid rgba(34, 197, 94, 0.2)' }}>💵 Efectivo</span>
                                                    );
                                                })()}
                                            </td>
                                            <td>
                                                {payment.receiptImage ? (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => window.open(resolveImageUrl(payment.receiptImage), '_blank')}
                                                    >
                                                        <FiImage /> Ver
                                                    </button>
                                                ) : (
                                                    <span className="badge badge-neutral">Sin recibo</span>
                                                )}
                                            </td>
                                            <td>
                                                <Link to={`/sales/${payment.saleId}`} className="btn btn-ghost btn-sm">
                                                    <FiEye /> Ver venta
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="mobile-card-list">
                        {filteredPayments.map(payment => {
                            const sale = getSaleById(payment.saleId);
                            const client = sale ? getClientById(sale.clientId) : null;
                            const project = sale ? getProjectById(sale.projectId) : null;

                            return (
                                <Link to={`/sales/${payment.saleId}`} key={payment.id} className="mobile-card-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div className="mobile-card-header">
                                        <div className="mobile-card-main">
                                            <div className="mobile-card-avatar">
                                                {(client?.name || client?.fullName)?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <div className="mobile-card-title">{client?.name || client?.fullName || '-'}</div>
                                                <div className="mobile-card-subtitle">{project?.name || '-'} · Lote {sale?.lotNumber || '-'}</div>
                                            </div>
                                        </div>
                                        <span className="mobile-card-value" style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
                                            {formatCurrency(payment.amount)}
                                        </span>
                                    </div>
                                    <div className="mobile-card-body">
                                        <div className="mobile-card-row">
                                            <span className="mobile-card-label">Fecha</span>
                                            <span className="mobile-card-value">{formatDate(payment.paymentDate || payment.createdAt)}</span>
                                        </div>
                                        <div className="mobile-card-row">
                                            <span className="mobile-card-label">Recibo</span>
                                            <span className="mobile-card-value">{payment.receiptImage ? '✓ Con recibo' : 'Sin recibo'}</span>
                                        </div>
                                        <div className="mobile-card-row">
                                            <span className="mobile-card-label">Método</span>
                                            <span className="mobile-card-value">
                                                {(() => {
                                                    const m = payment.paymentMethod || payment.payment_method || 'cash';
                                                    if (m === 'transfer') return '🏦 Transferencia';
                                                    if (m === 'permuta' || m === 'barter') return '🔄 Permuta';
                                                    return '💵 Efectivo';
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default PaymentList;
