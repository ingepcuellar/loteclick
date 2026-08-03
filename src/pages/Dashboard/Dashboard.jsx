import { useState, useEffect, useMemo } from 'react';
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
    FiAlertTriangle,
    FiGrid
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import { installmentService } from '../../services/installmentService';
import { api } from '../../lib/apiClient';
import { formatCurrency, formatDate } from '../../lib/formatters';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

function Dashboard() {
    const { state, getStats } = useApp();
    const stats = getStats();



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

        // Auto-generate overdue notifications
        api.post('endpoints/check-overdue.php').catch(() => { });
    }, []);

    // Pending acometida alerts
    const pendingAcometidas = useMemo(() => {
        return state.sales
            .filter(s => (s.includeAcometida || s.include_acometida) && !(s.acometidaPaid || s.acometida_paid))
            .map(sale => {
                const client = state.clients.find(c => c.id === sale.clientId);
                const project = state.projects.find(p => p.id === sale.projectId);
                return {
                    ...sale,
                    clientName: client?.name || client?.fullName || 'Cliente',
                    projectName: project?.name || 'Proyecto',
                    acometidaValue: parseFloat(sale.acometidaValue || sale.acometida_value || 0)
                };
            });
    }, [state.sales, state.clients, state.projects]);

    // Chart data: monthly revenue (last 6 months)
    const monthlyData = useMemo(() => {
        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
            months.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1), ventas: 0, pagos: 0 });
        }
        state.sales.forEach(sale => {
            const d = new Date(sale.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const found = months.find(m => m.key === key);
            if (found) found.ventas += parseFloat(sale.totalPrice || 0);
        });
        state.payments.forEach(payment => {
            const d = new Date(payment.createdAt || payment.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const found = months.find(m => m.key === key);
            if (found) found.pagos += parseFloat(payment.amount || 0);
        });
        return months;
    }, [state.sales, state.payments]);

    // Chart data: lot status distribution
    const lotStatusData = useMemo(() => {
        let available = 0, sold = 0, pending = 0;
        state.projects.forEach(project => {
            (project.lots || []).forEach(lot => {
                if (lot.status === 'sold') sold++;
                else if (lot.status === 'pending_initial') pending++;
                else available++;
            });
        });
        return [
            { name: 'Disponibles', value: available, color: '#22c55e' },
            { name: 'Vendidos', value: sold, color: '#6366f1' },
            { name: 'Pendientes', value: pending, color: '#f59e0b' }
        ].filter(d => d.value > 0);
    }, [state.projects]);

    const chartTooltipFormatter = (value) => formatCurrency(value);

    return (
        <div className="animate-fadeIn">
            {/* Stats Cards */}
            <div className="grid grid-4 mb-6">
                <StatCard
                    icon={FiFolder}
                    label="Proyectos"
                    value={stats.totalProjects}
                    trend={`${stats.availableLots} lotes disponibles`}
                    variant="primary"
                />
                <StatCard
                    icon={FiUsers}
                    label="Clientes"
                    value={stats.totalClients}
                    trend="Activos"
                    trendDirection="up"
                    variant="accent"
                />
                <StatCard
                    icon={FiShoppingCart}
                    label="Ventas"
                    value={stats.totalSales}
                    trend={formatCurrency(stats.totalRevenue)}
                    trendDirection="up"
                    variant="warning"
                />
                <StatCard
                    icon={FiDollarSign}
                    label="Recaudado"
                    value={formatCurrency(stats.totalCollected)}
                    trend={`${formatCurrency(stats.totalPending)} pendiente`}
                    trendDirection="down"
                    variant="info"
                />
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

            {/* Charts Section */}
            <div className="grid grid-2 mb-6">
                {/* Monthly Revenue Chart */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiTrendingUp className="card-title-icon" />
                            Ingresos Mensuales
                        </h3>
                    </div>
                    <div className="card-body">
                        {monthlyData.some(m => m.ventas > 0 || m.pagos > 0) ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                                    <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                                    <YAxis
                                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                        tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                                        width={55}
                                    />
                                    <Tooltip
                                        formatter={chartTooltipFormatter}
                                        contentStyle={{
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-primary)',
                                            borderRadius: 'var(--radius-lg)',
                                            color: 'var(--text-primary)'
                                        }}
                                        labelStyle={{ color: 'var(--text-secondary)' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                                    <Bar dataKey="ventas" name="Ventas" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="pagos" name="Pagos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState
                                icon={FiTrendingUp}
                                title="Sin datos"
                                description="Registra ventas para ver las gráficas"
                                style={{ padding: 'var(--spacing-8)' }}
                            />
                        )}
                    </div>
                </div>

                {/* Lot Status Pie Chart */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiGrid className="card-title-icon" />
                            Distribución de Lotes
                        </h3>
                    </div>
                    <div className="card-body">
                        {lotStatusData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={lotStatusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={4}
                                        dataKey="value"
                                        label={({ name, value }) => `${name}: ${value}`}
                                    >
                                        {lotStatusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-primary)',
                                            borderRadius: 'var(--radius-lg)',
                                            color: 'var(--text-primary)'
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState
                                icon={FiGrid}
                                title="Sin lotes"
                                description="Crea un proyecto con lotes para ver la distribución"
                                style={{ padding: 'var(--spacing-8)' }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Pending Acometida Alerts */}
            {pendingAcometidas.length > 0 && (
                <div className="card mb-6" style={{ borderLeft: '4px solid #f59e0b' }}>
                    <div className="card-header">
                        <h3 className="card-title" style={{ color: '#f59e0b' }}>
                            <FiAlertTriangle className="card-title-icon" />
                            🔧 Acometidas Pendientes de Pago ({pendingAcometidas.length})
                        </h3>
                    </div>
                    <div className="card-body">
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Proyecto</th>
                                        <th>Lote</th>
                                        <th>Valor Acometida</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingAcometidas.map(sale => (
                                        <tr key={sale.id}>
                                            <td style={{ fontWeight: 500 }}>{sale.clientName}</td>
                                            <td>{sale.projectName}</td>
                                            <td>Lote {sale.lotNumber}</td>
                                            <td style={{ fontWeight: 600, color: '#f59e0b' }}>
                                                {formatCurrency(sale.acometidaValue)}
                                            </td>
                                            <td>
                                                <Link to={`/sales/${sale.id}`} className="btn btn-ghost btn-sm">
                                                    Ver venta <FiArrowRight />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

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
                            <EmptyState
                                icon={FiFolder}
                                title="Sin proyectos"
                                description="Crea tu primer proyecto para comenzar"
                                actionLabel="Crear Proyecto"
                                actionTo="/projects/new"
                                style={{ padding: 'var(--spacing-8)' }}
                            />
                        ) : (
                            <div className="flex flex-col gap-4">
                                {state.projects.slice(0, 3).map(project => {
                                    const soldLots = project.lots?.filter(l => l.status === 'sold' || l.status === 'pending_initial').length || 0;
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
                            <EmptyState
                                icon={FiDollarSign}
                                title="Sin pagos pendientes"
                                description="Todas las ventas están al día"
                                style={{ padding: 'var(--spacing-8)' }}
                            />
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
