import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    FiFolder,
    FiDollarSign,
    FiTrendingUp,
    FiPercent,
    FiArrowRight,
    FiMapPin,
    FiCalendar,
    FiGrid
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { disbursementService } from '../../services/disbursementService';
import {
    PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer
} from 'recharts';

function PartnerDashboard() {
    const { state, getExpensesByProject } = useApp();
    const { currentUser, getAssociatedProjects } = useAuth();

    const [disbursements, setDisbursements] = useState([]);

    // Load partner disbursements
    useEffect(() => {
        const fetchDisbursements = async () => {
            if (!currentUser?.id) return;
            const { data, error } = await disbursementService.getByPartner(currentUser.id);
            if (!error && data) {
                setDisbursements(data);
            }
        };
        fetchDisbursements();
    }, [currentUser?.id]);

    // Filter projects for this partner
    const associatedProjectIds = getAssociatedProjects();
    const myProjects = useMemo(() => {
        return state.projects.filter(p =>
            associatedProjectIds.includes(p.id) ||
            associatedProjectIds.includes(String(p.id))
        );
    }, [state.projects, associatedProjectIds]);

    // Calculate per-project financials
    const projectData = useMemo(() => {
        const partnerName = currentUser?.name || '';

        return myProjects.map(project => {
            // Find this partner's percentage in the project
            const partnerEntry = (project.partners || []).find(p =>
                p.name?.toLowerCase() === partnerName.toLowerCase() ||
                p.id === currentUser?.id ||
                String(p.id) === String(currentUser?.id)
            );
            const percentage = parseFloat(partnerEntry?.percentage || 0);

            // Project total sales
            const projectSales = state.sales.filter(s =>
                (s.projectId === project.id || s.project_id === project.id)
            );
            const totalSales = projectSales.reduce((sum, s) =>
                sum + parseFloat(s.totalPrice || s.sale_price || 0), 0
            );

            // Project total collected
            const projectSaleIds = projectSales.map(s => s.id);
            const totalCollected = state.payments
                .filter(p => projectSaleIds.includes(p.saleId) || projectSaleIds.includes(p.sale_id))
                .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

            // Partner participation
            const participation = totalSales * (percentage / 100);
            const collectedParticipation = totalCollected * (percentage / 100);

            // Expenses for this project
            const projectExpenses = getExpensesByProject(project.id);
            const totalExpenses = projectExpenses.reduce((sum, e) =>
                sum + parseFloat(e.amount || 0), 0
            );
            const partnerExpenses = totalExpenses * (percentage / 100);

            // Disbursements for this project
            const projectDisbursements = disbursements.filter(d =>
                String(d.project_id) === String(project.id)
            );
            const totalDisbursed = projectDisbursements.reduce((sum, d) =>
                sum + parseFloat(d.amount || 0), 0
            );

            // Sold lots
            const soldLots = project.lots?.filter(l => l.status === 'sold').length || 0;
            const totalLots = project.lots?.length || 0;

            return {
                id: project.id,
                name: project.name,
                location: project.location,
                percentage,
                totalSales,
                totalCollected,
                participation,
                collectedParticipation,
                partnerExpenses,
                totalDisbursed,
                balance: collectedParticipation - totalDisbursed - partnerExpenses,
                soldLots,
                totalLots
            };
        });
    }, [myProjects, state.sales, state.payments, disbursements, currentUser, getExpensesByProject]);

    // Global stats for this partner
    const stats = useMemo(() => {
        const totalParticipation = projectData.reduce((sum, p) => sum + p.participation, 0);
        const totalCollected = projectData.reduce((sum, p) => sum + p.collectedParticipation, 0);
        const totalDisbursed = projectData.reduce((sum, p) => sum + p.totalDisbursed, 0);
        const totalExpenses = projectData.reduce((sum, p) => sum + p.partnerExpenses, 0);
        const balance = totalCollected - totalDisbursed - totalExpenses;

        return {
            projects: myProjects.length,
            totalParticipation,
            totalCollected,
            totalDisbursed,
            totalExpenses,
            balance
        };
    }, [projectData, myProjects]);

    // Chart data
    const chartData = useMemo(() => {
        return projectData
            .filter(p => p.participation > 0)
            .map(p => ({
                name: p.name,
                value: p.participation
            }));
    }, [projectData]);

    const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

    // Recent disbursements (last 5)
    const recentDisbursements = useMemo(() => {
        return [...disbursements]
            .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
            .slice(0, 5);
    }, [disbursements]);

    return (
        <div className="animate-fadeIn">
            {/* Welcome Header */}
            <div className="page-header" style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="page-header-content">
                    <h1>Hola, {currentUser?.name || 'Socio'} 👋</h1>
                    <p>Resumen de tu inversión en {myProjects.length} proyecto{myProjects.length !== 1 ? 's' : ''}</p>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="stats-grid mb-6">
                <StatCard
                    icon={FiFolder}
                    label="Mis Proyectos"
                    value={stats.projects}
                    variant="primary"
                />
                <StatCard
                    icon={FiPercent}
                    label="Participación Total"
                    value={formatCurrency(stats.totalParticipation)}
                    trend={`${formatCurrency(stats.totalCollected)} recaudado`}
                    trendDirection="up"
                    variant="accent"
                />
                <StatCard
                    icon={FiDollarSign}
                    label="Desembolsos Recibidos"
                    value={formatCurrency(stats.totalDisbursed)}
                    variant="warning"
                />
                <StatCard
                    icon={FiTrendingUp}
                    label="Balance Disponible"
                    value={formatCurrency(stats.balance)}
                    trend={stats.balance > 0 ? 'A favor' : stats.balance < 0 ? 'Deficit' : 'Al día'}
                    trendDirection={stats.balance >= 0 ? 'up' : 'down'}
                    variant="info"
                />
            </div>

            {/* Charts + Disbursements Row */}
            <div className="grid grid-2 mb-6">
                {/* Participation Pie Chart */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiGrid className="card-title-icon" />
                            Participación por Proyecto
                        </h3>
                    </div>
                    <div className="card-body">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={4}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {chartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => formatCurrency(value)}
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
                                title="Sin datos"
                                description="No hay participación calculada aún"
                                style={{ padding: 'var(--spacing-8)' }}
                            />
                        )}
                    </div>
                </div>

                {/* Recent Disbursements */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiDollarSign className="card-title-icon" />
                            Desembolsos Recientes
                        </h3>
                        <Link to="/disbursements" className="btn btn-ghost btn-sm">
                            Ver todos <FiArrowRight />
                        </Link>
                    </div>
                    <div className="card-body">
                        {recentDisbursements.length === 0 ? (
                            <EmptyState
                                icon={FiDollarSign}
                                title="Sin desembolsos"
                                description="Aún no tienes entregas registradas"
                                style={{ padding: 'var(--spacing-8)' }}
                            />
                        ) : (
                            <div className="flex flex-col gap-4">
                                {recentDisbursements.map(d => {
                                    const project = state.projects.find(p => String(p.id) === String(d.project_id));
                                    return (
                                        <div
                                            key={d.id}
                                            className="flex-between"
                                            style={{
                                                padding: 'var(--spacing-4)',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-lg)'
                                            }}
                                        >
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: 'var(--font-size-base)' }}>
                                                    {project?.name || 'Proyecto'}
                                                </h4>
                                                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                                    <FiCalendar size={12} style={{ marginRight: '4px' }} />
                                                    {formatDate(d.date || d.created_at)}
                                                </p>
                                            </div>
                                            <span className="badge badge-success" style={{ fontWeight: 600 }}>
                                                {formatCurrency(d.amount)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Projects Detail Table */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiFolder className="card-title-icon" />
                        Detalle por Proyecto
                    </h3>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                    {projectData.length === 0 ? (
                        <EmptyState
                            icon={FiFolder}
                            title="Sin proyectos"
                            description="No tienes proyectos asociados"
                        />
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Proyecto</th>
                                        <th>%</th>
                                        <th>Ventas</th>
                                        <th>Mi Participación</th>
                                        <th>Recaudado</th>
                                        <th>Gastos</th>
                                        <th>Desembolsado</th>
                                        <th>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectData.map(p => (
                                        <tr key={p.id}>
                                            <td>
                                                <Link to={`/projects/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                                        <FiMapPin size={10} /> {p.location} · {p.soldLots}/{p.totalLots} vendidos
                                                    </div>
                                                </Link>
                                            </td>
                                            <td>
                                                <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                                                    {p.percentage}%
                                                </span>
                                            </td>
                                            <td>{formatCurrency(p.totalSales)}</td>
                                            <td style={{ fontWeight: 600 }}>{formatCurrency(p.participation)}</td>
                                            <td style={{ color: 'var(--color-primary-400)' }}>{formatCurrency(p.collectedParticipation)}</td>
                                            <td style={{ color: 'var(--color-error, #ef4444)' }}>{formatCurrency(p.partnerExpenses)}</td>
                                            <td>{formatCurrency(p.totalDisbursed)}</td>
                                            <td>
                                                <span className={`badge ${p.balance >= 0 ? 'badge-success' : 'badge-error'}`}
                                                    style={{ fontWeight: 600 }}>
                                                    {formatCurrency(p.balance)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Totals Row */}
                                    <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-primary)' }}>
                                        <td>Total</td>
                                        <td></td>
                                        <td>{formatCurrency(projectData.reduce((s, p) => s + p.totalSales, 0))}</td>
                                        <td>{formatCurrency(stats.totalParticipation)}</td>
                                        <td>{formatCurrency(stats.totalCollected)}</td>
                                        <td>{formatCurrency(stats.totalExpenses)}</td>
                                        <td>{formatCurrency(stats.totalDisbursed)}</td>
                                        <td>
                                            <span className={`badge ${stats.balance >= 0 ? 'badge-success' : 'badge-error'}`}>
                                                {formatCurrency(stats.balance)}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Cards for Projects */}
            <div className="mobile-cards" style={{ display: 'none' }}>
                {projectData.map(p => (
                    <Link key={p.id} to={`/projects/${p.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', marginBottom: 'var(--spacing-4)' }}>
                        <div className="card-body">
                            <div className="flex-between" style={{ marginBottom: 'var(--spacing-3)' }}>
                                <div>
                                    <h4 style={{ margin: 0 }}>{p.name}</h4>
                                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                        <FiMapPin size={10} /> {p.location}
                                    </p>
                                </div>
                                <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                                    {p.percentage}%
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Participación</div>
                                    <div style={{ fontWeight: 600 }}>{formatCurrency(p.participation)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Desembolsado</div>
                                    <div>{formatCurrency(p.totalDisbursed)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Gastos</div>
                                    <div style={{ color: 'var(--color-error, #ef4444)' }}>{formatCurrency(p.partnerExpenses)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Balance</div>
                                    <div style={{ fontWeight: 600, color: p.balance >= 0 ? 'var(--color-primary-400)' : 'var(--color-error, #ef4444)' }}>
                                        {formatCurrency(p.balance)}
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: 'var(--spacing-3)' }}>
                                <span className="badge badge-success">{p.soldLots}/{p.totalLots} vendidos</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default PartnerDashboard;
