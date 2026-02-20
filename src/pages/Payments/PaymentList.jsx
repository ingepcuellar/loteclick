import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    FiPlus,
    FiDollarSign,
    FiSearch,
    FiCalendar,
    FiFilter,
    FiEye,
    FiImage
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';

function PaymentList() {
    const { state, getSaleById, getClientById, getProjectById } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('');

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Sort payments by date (newest first)
    const sortedPayments = [...state.payments].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const filteredPayments = sortedPayments.filter(payment => {
        const sale = getSaleById(payment.saleId);
        const client = sale ? getClientById(sale.clientId) : null;
        const project = sale ? getProjectById(sale.projectId) : null;

        const matchesSearch = !searchTerm ||
            (client?.name || client?.fullName)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client?.document || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project?.name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesProject = !filterProject || sale?.projectId === filterProject;

        return matchesSearch && matchesProject;
    });

    // Calculate totals
    const totalPayments = filteredPayments.reduce(
        (sum, p) => sum + parseFloat(p.amount || 0), 0
    );

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
            <div className="grid grid-3 mb-6">
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <FiDollarSign />
                        </div>
                        <div className="stat-content">
                            <h3>{filteredPayments.length}</h3>
                            <p>Total Pagos</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon accent">
                            <FiDollarSign />
                        </div>
                        <div className="stat-content">
                            <h3>{formatCurrency(totalPayments)}</h3>
                            <p>Total Recaudado</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon info">
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
                            placeholder="Buscar por cliente, cédula o proyecto..."
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
                        {state.projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
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
                                                {payment.receiptImage ? (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => window.open(payment.receiptImage, '_blank')}
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
                </div>
            )}
        </div>
    );
}

export default PaymentList;
