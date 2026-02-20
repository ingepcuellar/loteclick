import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    FiFolder,
    FiUsers,
    FiShoppingCart,
    FiDollarSign,
    FiTrendingUp,
    FiTrendingDown,
    FiPlus,
    FiArrowRight,
    FiMapPin,
    FiCalendar,
    FiAlertTriangle
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { installmentService } from '../../services/installmentService';

function Dashboard() {
    const { state, getStats } = useApp();
    const stats = getStats();

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

    // Recent sales
    const recentSales = [...state.sales]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

    // Pending payments
    const salesWithPendingPayments = state.sales
        .map(sale => {
            const paid = state.payments
                .filter(p => p.saleId === sale.id)
                .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
            const pending = parseFloat(sale.totalPrice || 0) - paid;
            return { ...sale, pending, paid };
        })
        .filter(sale => sale.pending > 0)
        .slice(0, 5);

    // Overdue installments
    const [overdueInstallments, setOverdueInstallments] = useState([]);
    useEffect(() => {
        const fetchOverdue = async () => {
            const { data, error } = await installmentService.getOverdue();
            if (!error && data) {
                setOverdueInstallments(data);
            }
        };
        fetchOverdue();
    }, []);

    return (
        <div className="animate-fadeIn">
            {/* Stats Cards */}
            <div className="grid grid-4 mb-6">
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <FiFolder />
                        </div>
                        <div className="stat-content">
                            <h3>{stats.totalProjects}</h3>
                            <p>Proyectos</p>
                            <div className="stat-trend up">
                                <span>{stats.availableLots} lotes disponibles</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon accent">
                            <FiUsers />
                        </div>
                        <div className="stat-content">
                            <h3>{stats.totalClients}</h3>
                            <p>Clientes</p>
                            <div className="stat-trend up">
                                <FiTrendingUp size={14} />
                                <span>Activos</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon warning">
                            <FiShoppingCart />
                        </div>
                        <div className="stat-content">
                            <h3>{stats.totalSales}</h3>
                            <p>Ventas</p>
                            <div className="stat-trend up">
                                <span>{formatCurrency(stats.totalRevenue)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon info">
                            <FiDollarSign />
                        </div>
                        <div className="stat-content">
                            <h3>{formatCurrency(stats.totalCollected)}</h3>
                            <p>Recaudado</p>
                            <div className="stat-trend down">
                                <FiTrendingDown size={14} />
                                <span>{formatCurrency(stats.totalPending)} pendiente</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card mb-6">
                <div className="card-header">
                    <h3 className="card-title">Acciones Rápidas</h3>
                </div>
                <div className="card-body">
                    <div className="grid grid-4">
                        <Link to="/projects/new" className="btn btn-primary">
                            <FiPlus />
                            Nuevo Proyecto
                        </Link>
                        <Link to="/clients/new" className="btn btn-secondary">
                            <FiPlus />
                            Nuevo Cliente
                        </Link>
                        <Link to="/sales/new" className="btn btn-secondary">
                            <FiPlus />
                            Nueva Venta
                        </Link>
                        <Link to="/payments/new" className="btn btn-secondary">
                            <FiPlus />
                            Registrar Pago
                        </Link>
                    </div>
                </div>
            </div>

            {/* Overdue Alerts */}
            {overdueInstallments.length > 0 && (
                <div className="card mb-6" style={{ borderLeft: '4px solid #ef4444' }}>
                    <div className="card-header">
                        <h3 className="card-title" style={{ color: '#ef4444' }}>
                            <FiAlertTriangle className="card-title-icon" />
                            ⚠️ Cuotas Vencidas ({overdueInstallments.length})
                        </h3>
                        <Link to="/payments" className="btn btn-ghost btn-sm">
                            Ver pagos <FiArrowRight />
                        </Link>
                    </div>
                    <div className="card-body">
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Cédula</th>
                                        <th>Proyecto / Lote</th>
                                        <th>Cuota</th>
                                        <th>Monto</th>
                                        <th>Días Vencida</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {overdueInstallments.slice(0, 10).map(inst => (
                                        <tr key={inst.id}>
                                            <td style={{ fontWeight: 500 }}>{inst.client_name}</td>
                                            <td>{inst.client_document}</td>
                                            <td>
                                                <div>{inst.project_name}</div>
                                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                                    Lote {inst.lot_number}
                                                </div>
                                            </td>
                                            <td>#{inst.installment_number}</td>
                                            <td style={{ fontWeight: 600, color: '#ef4444' }}>
                                                {formatCurrency(inst.amount)}
                                            </td>
                                            <td>
                                                <span className="badge" style={{
                                                    background: inst.days_overdue > 30 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                                    color: inst.days_overdue > 30 ? '#ef4444' : '#f59e0b'
                                                }}>
                                                    {inst.days_overdue} días
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-2">
                {/* Recent Projects */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiFolder className="card-title-icon" />
                            Proyectos Recientes
                        </h3>
                        <Link to="/projects" className="btn btn-ghost btn-sm">
                            Ver todos <FiArrowRight />
                        </Link>
                    </div>
                    <div className="card-body">
                        {state.projects.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--spacing-8)' }}>
                                <div className="empty-state-icon">
                                    <FiFolder />
                                </div>
                                <h3>Sin proyectos</h3>
                                <p>Crea tu primer proyecto para comenzar</p>
                                <Link to="/projects/new" className="btn btn-primary btn-sm">
                                    <FiPlus /> Crear Proyecto
                                </Link>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {state.projects.slice(0, 3).map(project => {
                                    const soldLots = project.lots?.filter(l => l.status === 'sold').length || 0;
                                    const totalLots = project.lots?.length || 0;

                                    return (
                                        <Link
                                            key={project.id}
                                            to={`/projects/${project.id}`}
                                            className="flex-between"
                                            style={{
                                                padding: 'var(--spacing-4)',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-lg)',
                                                textDecoration: 'none'
                                            }}
                                        >
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: 'var(--font-size-base)' }}>
                                                    {project.name}
                                                </h4>
                                                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                                    <FiMapPin size={12} style={{ marginRight: '4px' }} />
                                                    {project.location}
                                                </p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span className="badge badge-success">
                                                    {soldLots}/{totalLots} vendidos
                                                </span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Pending Payments */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiDollarSign className="card-title-icon" />
                            Pagos Pendientes
                        </h3>
                        <Link to="/payments" className="btn btn-ghost btn-sm">
                            Ver todos <FiArrowRight />
                        </Link>
                    </div>
                    <div className="card-body">
                        {salesWithPendingPayments.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--spacing-8)' }}>
                                <div className="empty-state-icon">
                                    <FiDollarSign />
                                </div>
                                <h3>Sin pagos pendientes</h3>
                                <p>Todas las ventas están al día</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {salesWithPendingPayments.map(sale => {
                                    const client = state.clients.find(c => c.id === sale.clientId);
                                    const project = state.projects.find(p => p.id === sale.projectId);

                                    return (
                                        <div
                                            key={sale.id}
                                            className="flex-between"
                                            style={{
                                                padding: 'var(--spacing-4)',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-lg)'
                                            }}
                                        >
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: 'var(--font-size-base)' }}>
                                                    {client?.name || client?.fullName || 'Cliente'}
                                                </h4>
                                                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                                    {project?.name || 'Proyecto'} - Lote {sale.lotNumber}
                                                </p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span className="badge badge-warning">
                                                    {formatCurrency(sale.pending)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Sales */}
            {recentSales.length > 0 && (
                <div className="card mt-6">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiShoppingCart className="card-title-icon" />
                            Ventas Recientes
                        </h3>
                        <Link to="/sales" className="btn btn-ghost btn-sm">
                            Ver todas <FiArrowRight />
                        </Link>
                    </div>
                    <div className="card-body">
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Proyecto</th>
                                        <th>Lote</th>
                                        <th>Precio</th>
                                        <th>Fecha</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentSales.map(sale => {
                                        const client = state.clients.find(c => c.id === sale.clientId);
                                        const project = state.projects.find(p => p.id === sale.projectId);
                                        const paid = state.payments
                                            .filter(p => p.saleId === sale.id)
                                            .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                                        const isPaid = paid >= parseFloat(sale.totalPrice || 0);

                                        return (
                                            <tr key={sale.id}>
                                                <td>{client?.name || client?.fullName || '-'}</td>
                                                <td>{project?.name || '-'}</td>
                                                <td>Lote {sale.lotNumber}</td>
                                                <td>{formatCurrency(sale.totalPrice)}</td>
                                                <td>
                                                    <FiCalendar size={12} style={{ marginRight: '4px' }} />
                                                    {formatDate(sale.createdAt)}
                                                </td>
                                                <td>
                                                    <span className={`badge ${isPaid ? 'badge-success' : 'badge-warning'}`}>
                                                        {isPaid ? 'Pagado' : 'Pendiente'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
