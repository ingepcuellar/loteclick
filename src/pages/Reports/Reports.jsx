import { useState } from 'react';
import {
    FiBarChart2,
    FiDollarSign,
    FiUsers,
    FiFolder,
    FiShoppingCart,
    FiTrendingUp,
    FiCalendar,
    FiDownload,
    FiUserCheck,
    FiMap,
    FiMapPin,
    FiFileText
} from 'react-icons/fi';
import {
    exportSalesPDF,
    exportPaymentsPDF,
    exportExpensesPDF,
    exportAgentsPDF
} from '../../lib/pdfExporter';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../lib/formatters';

// Category labels for display
const CATEGORY_LABELS = {
    commissions: 'Comisiones',
    signatures: 'Firmas',
    construction: 'Obras',
    utilities_water: 'Agua',
    utilities_energy: 'Energía',
    utilities_internet: 'Internet',
    rent: 'Arriendos',
    payroll: 'Nómina',
    employee_loans: 'Préstamo Empleados',
    legal: 'Legal',
    marketing: 'Marketing',
    administrative: 'Administrativo',
    infrastructure: 'Infraestructura',
    other: 'Otros'
};

const CATEGORY_COLORS = {
    commissions: '#f97316',
    signatures: '#6366f1',
    construction: '#3b82f6',
    utilities_water: '#06b6d4',
    utilities_energy: '#eab308',
    utilities_internet: '#8b5cf6',
    rent: '#14b8a6',
    payroll: '#ec4899',
    employee_loans: '#a855f7',
    legal: '#7c3aed',
    marketing: '#e11d48',
    administrative: '#f59e0b',
    infrastructure: '#2563eb',
    other: '#6b7280'
};

function Reports() {
    const { state, getStats, getPaymentsBySale } = useApp();
    const [selectedProject, setSelectedProject] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    // Month selector for cartera report (defaults to current month)
    const now = new Date();
    const [carteraMonth, setCarteraMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
    const [carteraYear, setCarteraYear] = useState(String(now.getFullYear()));
    const [carteraProject, setCarteraProject] = useState('');

    const stats = getStats();



    // Filter data based on project and date
    const filterByDateAndProject = (items, dateField = 'createdAt') => {
        return items.filter(item => {
            const matchesProject = !selectedProject || item.projectId === selectedProject;
            const itemDate = new Date(item[dateField]);
            const matchesStart = !dateRange.start || itemDate >= new Date(dateRange.start);
            const matchesEnd = !dateRange.end || itemDate <= new Date(dateRange.end + 'T23:59:59');
            return matchesProject && matchesStart && matchesEnd;
        });
    };

    const filteredSales = filterByDateAndProject(state.sales);
    const filteredPayments = state.payments.filter(p => {
        const sale = state.sales.find(s => s.id === p.saleId);
        if (!sale) return false;
        const matchesProject = !selectedProject || sale.projectId === selectedProject;
        const paymentDate = new Date(p.paymentDate || p.createdAt);
        const matchesStart = !dateRange.start || paymentDate >= new Date(dateRange.start);
        const matchesEnd = !dateRange.end || paymentDate <= new Date(dateRange.end + 'T23:59:59');
        return matchesProject && matchesStart && matchesEnd;
    });

    // Calculate filtered stats
    const filteredTotalSales = filteredSales.reduce((sum, s) => sum + parseFloat(s.totalPrice || 0), 0);
    const filteredTotalPayments = filteredPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const filteredPending = filteredTotalSales - filteredTotalPayments;

    // Filter expenses
    const filteredExpenses = state.expenses.filter(expense => {
        const matchesProject = !selectedProject || expense.projectId === selectedProject || expense.project_id === selectedProject;
        const expenseDate = new Date(expense.date || expense.expense_date || expense.createdAt);
        const matchesStart = !dateRange.start || expenseDate >= new Date(dateRange.start);
        const matchesEnd = !dateRange.end || expenseDate <= new Date(dateRange.end + 'T23:59:59');
        return matchesProject && matchesStart && matchesEnd;
    });
    const filteredTotalExpenses = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    // Lot counts
    const getFilteredLots = () => {
        const projects = selectedProject
            ? state.projects.filter(p => p.id === selectedProject)
            : state.projects;
        const allLots = projects.flatMap(p => p.lots || []);
        return {
            sold: allLots.filter(l => l.status === 'sold').length,
            available: allLots.filter(l => l.status === 'available').length,
            reserved: allLots.filter(l => l.status === 'reserved').length,
            total: allLots.length,
        };
    };
    const lotCounts = getFilteredLots();

    // Expense breakdown by category
    const getExpenseBreakdown = () => {
        const breakdown = {};
        filteredExpenses.forEach(expense => {
            const cat = expense.category || 'other';
            if (!breakdown[cat]) {
                breakdown[cat] = { category: cat, label: CATEGORY_LABELS[cat] || cat, count: 0, total: 0, color: CATEGORY_COLORS[cat] || '#6b7280' };
            }
            breakdown[cat].count += 1;
            breakdown[cat].total += parseFloat(expense.amount || 0);
        });

        // Group utilities
        const utilityKeys = ['utilities_water', 'utilities_energy', 'utilities_internet'];
        const utilityTotal = utilityKeys.reduce((sum, k) => sum + (breakdown[k]?.total || 0), 0);
        const utilityCount = utilityKeys.reduce((sum, k) => sum + (breakdown[k]?.count || 0), 0);

        return {
            detailed: Object.values(breakdown).sort((a, b) => b.total - a.total),
            utilitiesGrouped: { total: utilityTotal, count: utilityCount },
        };
    };
    const expenseBreakdown = getExpenseBreakdown();

    // Partners distribution
    const getPartnerDistribution = () => {
        const projectId = selectedProject || null;
        const relevantSales = projectId
            ? filteredSales.filter(s => s.projectId === projectId)
            : filteredSales;

        const distribution = {};

        relevantSales.forEach(sale => {
            const project = state.projects.find(p => p.id === sale.projectId);
            if (project?.partners) {
                const salePayments = getPaymentsBySale(sale.id).filter(p => {
                    const paymentDate = new Date(p.paymentDate || p.createdAt);
                    const matchesStart = !dateRange.start || paymentDate >= new Date(dateRange.start);
                    const matchesEnd = !dateRange.end || paymentDate <= new Date(dateRange.end + 'T23:59:59');
                    return matchesStart && matchesEnd;
                });
                const paidAmount = salePayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

                project.partners.forEach(partner => {
                    const partnerAmount = paidAmount * (partner.percentage / 100);
                    if (!distribution[partner.name]) {
                        distribution[partner.name] = { name: partner.name, percentage: partner.percentage, amount: 0 };
                    }
                    distribution[partner.name].amount += partnerAmount;
                });
            }
        });

        return Object.values(distribution);
    };

    const partnerDistribution = getPartnerDistribution();

    // Commission Agent Performance
    const getAgentPerformance = () => {
        const agentMap = {};

        filteredSales.forEach(sale => {
            const agentName = sale.commissionAgent || sale.commission_agent || null;
            if (!agentName) return;

            if (!agentMap[agentName]) {
                agentMap[agentName] = {
                    name: agentName,
                    salesCount: 0,
                    totalRevenue: 0,
                    collected: 0,
                    commissionTotal: 0,
                    projects: new Set()
                };
            }

            agentMap[agentName].salesCount += 1;
            agentMap[agentName].totalRevenue += parseFloat(sale.totalPrice || 0);
            agentMap[agentName].commissionTotal += parseFloat(sale.commissionAmount || sale.commission_amount || 0);

            const salePayments = getPaymentsBySale(sale.id).filter(p => {
                const paymentDate = new Date(p.paymentDate || p.createdAt);
                const matchesStart = !dateRange.start || paymentDate >= new Date(dateRange.start);
                const matchesEnd = !dateRange.end || paymentDate <= new Date(dateRange.end + 'T23:59:59');
                return matchesStart && matchesEnd;
            });
            agentMap[agentName].collected += salePayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

            const project = state.projects.find(p => p.id === sale.projectId);
            if (project) agentMap[agentName].projects.add(project.name);
        });

        return Object.values(agentMap)
            .map(a => ({ ...a, pending: a.totalRevenue - a.collected, projects: [...a.projects] }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue);
    };

    const agentPerformance = getAgentPerformance();
    const totalCommissions = agentPerformance.reduce((sum, a) => sum + a.commissionTotal, 0);

    // Project performance
    const getProjectPerformance = () => {
        return state.projects.map(project => {
            const projectSales = filteredSales.filter(s => s.projectId === project.id);
            const totalLots = project.lots?.length || 0;
            const soldLots = project.lots?.filter(l => l.status === 'sold').length || 0;
            const revenue = projectSales.reduce((sum, s) => sum + parseFloat(s.totalPrice || 0), 0);
            const collected = projectSales.reduce((sum, sale) => {
                const payments = getPaymentsBySale(sale.id).filter(p => {
                    const paymentDate = new Date(p.paymentDate || p.createdAt);
                    const matchesStart = !dateRange.start || paymentDate >= new Date(dateRange.start);
                    const matchesEnd = !dateRange.end || paymentDate <= new Date(dateRange.end + 'T23:59:59');
                    return matchesStart && matchesEnd;
                });
                return sum + payments.reduce((pSum, p) => pSum + parseFloat(p.amount || 0), 0);
            }, 0);

            return {
                id: project.id,
                name: project.name,
                location: project.location,
                totalLots,
                soldLots,
                availableLots: totalLots - soldLots,
                progress: totalLots > 0 ? (soldLots / totalLots) * 100 : 0,
                revenue,
                collected,
                pending: revenue - collected,
            };
        });
    };

    const projectPerformance = getProjectPerformance();

    // Export to CSV
    const exportToCSV = (data, filename) => {
        let csv = '';

        if (filename === 'ventas') {
            csv = 'Fecha,Proyecto,Lote,Cliente,Precio,Estado\n';
            filteredSales.forEach(sale => {
                const client = state.clients.find(c => c.id === sale.clientId);
                const project = state.projects.find(p => p.id === sale.projectId);
                const paid = getPaymentsBySale(sale.id).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                const status = paid >= parseFloat(sale.totalPrice) ? 'Pagado' : 'Pendiente';
                csv += `${formatDate(sale.createdAt)},${project?.name || ''},${sale.lotNumber},${client?.name || client?.fullName || ''},${sale.totalPrice},${status}\n`;
            });
        } else if (filename === 'pagos') {
            csv = 'Fecha,Cliente,Proyecto,Lote,Monto\n';
            filteredPayments.forEach(payment => {
                const sale = state.sales.find(s => s.id === payment.saleId);
                const client = sale ? state.clients.find(c => c.id === sale.clientId) : null;
                const project = sale ? state.projects.find(p => p.id === sale.projectId) : null;
                csv += `${formatDate(payment.paymentDate || payment.createdAt)},${client?.name || client?.fullName || ''},${project?.name || ''},${sale?.lotNumber || ''},${payment.amount}\n`;
            });
        } else if (filename === 'gastos') {
            csv = 'Fecha,Proyecto,Categoría,Descripción,Monto\n';
            filteredExpenses.forEach(expense => {
                const project = state.projects.find(p => p.id === (expense.projectId || expense.project_id));
                csv += `${formatDate(expense.date || expense.expense_date || expense.createdAt)},${project?.name || ''},${CATEGORY_LABELS[expense.category] || expense.category},"${expense.description || ''}",${expense.amount}\n`;
            });
        } else if (filename === 'comisionistas') {
            csv = 'Comisionista,Proyectos,Ventas,Total Vendido,Comisión,Recaudado,Pendiente\n';
            agentPerformance.forEach(agent => {
                csv += `"${agent.name}","${agent.projects.join(', ')}",${agent.salesCount},${agent.totalRevenue},${agent.commissionTotal},${agent.collected},${agent.pending}\n`;
            });
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    // Utilidad (ganancia)
    const netProfit = filteredTotalPayments - filteredTotalExpenses;

    // Stat card component
    const StatCard = ({ icon: Icon, label, value, color, subtext }) => (
        <div className="card" style={{ minWidth: 0 }}>
            <div className="stat-card">
                <div className="stat-icon" style={{ background: color || 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))' }}>
                    <Icon />
                </div>
                <div className="stat-content">
                    <h3 style={{ fontSize: 'clamp(0.9rem, 2vw, 1.2rem)', wordBreak: 'break-word' }}>{value}</h3>
                    <p>{label}</p>
                    {subtext && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{subtext}</span>}
                </div>
            </div>
        </div>
    );

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <h1>Reportes</h1>
                    <p>Análisis y reportes del sistema</p>
                </div>
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0, minWidth: '180px', flex: 1 }}>
                        <label className="form-label">Proyecto</label>
                        <select
                            className="form-select"
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value)}
                        >
                            <option value="">Todos los proyectos</option>
                            {state.projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '140px' }}>
                        <label className="form-label">Fecha Inicio</label>
                        <input
                            type="date"
                            className="form-input"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '140px' }}>
                        <label className="form-label">Fecha Fin</label>
                        <input
                            type="date"
                            className="form-input"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        />
                    </div>

                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            setSelectedProject('');
                            setDateRange({ start: '', end: '' });
                        }}
                    >
                        Limpiar
                    </button>
                </div>
            </div>

            {/* ===== KPI CARDS (responsive grid) ===== */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--spacing-4)',
                marginBottom: 'var(--spacing-6)'
            }}>
                <StatCard icon={FiShoppingCart} label="Ventas" value={filteredSales.length} color="linear-gradient(135deg, #6366f1, #4f46e5)" />
                <StatCard icon={FiTrendingUp} label="Total Vendido" value={formatCurrency(filteredTotalSales)} color="linear-gradient(135deg, #2d6a4f, #40916c)" />
                <StatCard icon={FiDollarSign} label="Recaudado" value={formatCurrency(filteredTotalPayments)} color="linear-gradient(135deg, #0891b2, #06b6d4)" />
                <StatCard icon={FiDollarSign} label="Cartera" value={formatCurrency(filteredPending)} color="linear-gradient(135deg, #d97706, #f59e0b)" subtext="Pendiente por cobrar" />
                <StatCard icon={FiMap} label="Lotes Vendidos" value={lotCounts.sold} color="linear-gradient(135deg, #059669, #10b981)" subtext={`de ${lotCounts.total} totales`} />
                <StatCard icon={FiMapPin} label="Lotes Disponibles" value={lotCounts.available} color="linear-gradient(135deg, #7c3aed, #8b5cf6)" />
                <StatCard icon={FiDollarSign} label="Total Gastos" value={formatCurrency(filteredTotalExpenses)} color="linear-gradient(135deg, #ef4444, #dc2626)" />
                <StatCard icon={FiTrendingUp} label="Utilidad" value={formatCurrency(netProfit)} color={netProfit >= 0 ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #ef4444, #dc2626)'} subtext="Recaudado − Gastos" />
            </div>

            {/* ===== EXPENSE BREAKDOWN BY CATEGORY ===== */}
            <div className="card mb-6">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiBarChart2 className="card-title-icon" />
                        Gastos Discriminados por Categoría
                    </h3>
                </div>
                <div className="card-body">
                    {expenseBreakdown.detailed.length === 0 ? (
                        <p className="text-muted text-center">No hay gastos en el periodo seleccionado</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Categoría</th>
                                        <th style={{ textAlign: 'center' }}>Cantidad</th>
                                        <th style={{ textAlign: 'right' }}>Total</th>
                                        <th style={{ textAlign: 'right' }}>% del Total</th>
                                        <th style={{ width: '25%' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenseBreakdown.detailed.map((item) => {
                                        const pct = filteredTotalExpenses > 0 ? (item.total / filteredTotalExpenses) * 100 : 0;
                                        return (
                                            <tr key={item.category}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{
                                                            width: '10px', height: '10px', borderRadius: '50%',
                                                            background: item.color, flexShrink: 0
                                                        }} />
                                                        <span style={{ fontWeight: '500' }}>{item.label}</span>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className="badge badge-info">{item.count}</span>
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                                    {formatCurrency(item.total)}
                                                </td>
                                                <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                                    {pct.toFixed(1)}%
                                                </td>
                                                <td>
                                                    <div style={{
                                                        height: '6px', background: 'var(--bg-secondary)',
                                                        borderRadius: 'var(--radius-full)', overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            width: `${pct}%`, height: '100%',
                                                            background: item.color, borderRadius: 'var(--radius-full)',
                                                            transition: 'width 0.5s ease'
                                                        }} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: '700' }}>
                                        <td>Total Gastos</td>
                                        <td style={{ textAlign: 'center' }}>
                                            {expenseBreakdown.detailed.reduce((s, i) => s + i.count, 0)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#ef4444' }}>
                                            {formatCurrency(filteredTotalExpenses)}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>100%</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ===== PROJECT + PARTNER GRID ===== */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: 'var(--spacing-4)',
                marginBottom: 'var(--spacing-6)'
            }}>
                {/* Project Performance */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiFolder className="card-title-icon" />
                            Rendimiento por Proyecto
                        </h3>
                    </div>
                    <div className="card-body">
                        {projectPerformance.length === 0 ? (
                            <p className="text-muted text-center">No hay proyectos</p>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {projectPerformance.map(project => (
                                    <div
                                        key={project.id}
                                        style={{
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-lg)',
                                            padding: 'var(--spacing-4)',
                                        }}
                                    >
                                        <div className="flex-between mb-2">
                                            <div>
                                                <div style={{ fontWeight: '600' }}>{project.name}</div>
                                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                                    {project.soldLots}/{project.totalLots} lotes vendidos · {project.availableLots} disponibles
                                                </div>
                                            </div>
                                            <span className="badge badge-success">{Math.round(project.progress)}%</span>
                                        </div>
                                        <div style={{
                                            height: '6px',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: 'var(--radius-full)',
                                            overflow: 'hidden',
                                            marginBottom: 'var(--spacing-2)'
                                        }}>
                                            <div style={{
                                                width: `${project.progress}%`,
                                                height: '100%',
                                                background: 'linear-gradient(90deg, var(--color-primary-500), var(--color-accent-500))',
                                                borderRadius: 'var(--radius-full)'
                                            }} />
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem', fontSize: 'var(--font-size-sm)' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>
                                                Vendido: <span style={{ color: 'var(--color-primary-400)', fontWeight: '500' }}>{formatCurrency(project.revenue)}</span>
                                            </span>
                                            <span style={{ color: 'var(--text-muted)' }}>
                                                Recaudado: <span style={{ color: 'var(--color-success)', fontWeight: '500' }}>{formatCurrency(project.collected)}</span>
                                            </span>
                                            <span style={{ color: 'var(--text-muted)' }}>
                                                Cartera: <span style={{ color: 'var(--color-warning)', fontWeight: '500' }}>{formatCurrency(project.pending)}</span>
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Partner Distribution */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiUsers className="card-title-icon" />
                            Distribución por Socios
                        </h3>
                    </div>
                    <div className="card-body">
                        {partnerDistribution.length === 0 ? (
                            <p className="text-muted text-center">No hay datos de socios</p>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {partnerDistribution.map((partner, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-lg)',
                                            padding: 'var(--spacing-4)',
                                        }}
                                    >
                                        <div className="flex-between mb-2">
                                            <div style={{ fontWeight: '600' }}>{partner.name}</div>
                                            <span className="badge badge-info">{partner.percentage}%</span>
                                        </div>
                                        <div style={{
                                            fontSize: 'var(--font-size-xl)',
                                            fontWeight: '700',
                                            color: 'var(--color-primary-400)'
                                        }}>
                                            {formatCurrency(partner.amount)}
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                            Correspondiente al periodo seleccionado
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Commission Agent Report */}
            <div className="card mb-6">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiUserCheck className="card-title-icon" />
                        Reporte por Comisionista
                    </h3>
                </div>
                <div className="card-body">
                    {agentPerformance.length === 0 ? (
                        <p className="text-muted text-center">No hay ventas con comisionista asignado en el periodo seleccionado</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Comisionista</th>
                                        <th>Proyectos</th>
                                        <th style={{ textAlign: 'center' }}>Ventas</th>
                                        <th style={{ textAlign: 'right' }}>Total Vendido</th>
                                        <th style={{ textAlign: 'right' }}>Comisión</th>
                                        <th style={{ textAlign: 'right' }}>Recaudado</th>
                                        <th style={{ textAlign: 'right' }}>Pendiente</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {agentPerformance.map((agent, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <div style={{ fontWeight: '600' }}>{agent.name}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                                    {agent.projects.join(', ')}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="badge badge-info">{agent.salesCount}</span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: '500' }}>
                                                {formatCurrency(agent.totalRevenue)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: '500', color: '#f97316' }}>
                                                {formatCurrency(agent.commissionTotal)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: '500' }}>
                                                {formatCurrency(agent.collected)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--color-warning)', fontWeight: '500' }}>
                                                {formatCurrency(agent.pending)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: '700' }}>
                                        <td>Total</td>
                                        <td></td>
                                        <td style={{ textAlign: 'center' }}>
                                            {agentPerformance.reduce((sum, a) => sum + a.salesCount, 0)}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {formatCurrency(agentPerformance.reduce((sum, a) => sum + a.totalRevenue, 0))}
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#f97316' }}>
                                            {formatCurrency(totalCommissions)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>
                                            {formatCurrency(agentPerformance.reduce((sum, a) => sum + a.collected, 0))}
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--color-warning)' }}>
                                            {formatCurrency(agentPerformance.reduce((sum, a) => sum + a.pending, 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Export Options */}
            <div className="card mb-6">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiDownload className="card-title-icon" />
                        Exportar Datos
                    </h3>
                </div>
                <div className="card-body">
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--spacing-4)' }}>
                        Descarga los datos filtrados en formato CSV o PDF profesional.
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary" onClick={() => exportToCSV(filteredSales, 'ventas')} disabled={filteredSales.length === 0}>
                            <FiDownload /> Ventas (CSV)
                        </button>
                        <button className="btn btn-primary" onClick={() => {
                            const period = dateRange.start && dateRange.end ? `${dateRange.start} a ${dateRange.end}` : 'Todo';
                            const projName = selectedProject ? state.projects.find(p => p.id === selectedProject)?.name : '';
                            exportSalesPDF(filteredSales, state.clients, state.projects, getPaymentsBySale, formatCurrency, formatDate, period, projName);
                        }} disabled={filteredSales.length === 0}>
                            <FiFileText /> Ventas (PDF)
                        </button>

                        <button className="btn btn-secondary" onClick={() => exportToCSV(filteredPayments, 'pagos')} disabled={filteredPayments.length === 0}>
                            <FiDownload /> Pagos (CSV)
                        </button>
                        <button className="btn btn-primary" onClick={() => {
                            const period = dateRange.start && dateRange.end ? `${dateRange.start} a ${dateRange.end}` : 'Todo';
                            const projName = selectedProject ? state.projects.find(p => p.id === selectedProject)?.name : '';
                            exportPaymentsPDF(filteredPayments, state.sales, state.clients, state.projects, formatCurrency, formatDate, period, projName);
                        }} disabled={filteredPayments.length === 0}>
                            <FiFileText /> Pagos (PDF)
                        </button>

                        <button className="btn btn-secondary" onClick={() => exportToCSV(filteredExpenses, 'gastos')} disabled={filteredExpenses.length === 0}
                            style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', borderColor: 'transparent' }}>
                            <FiDownload /> Gastos (CSV)
                        </button>
                        <button className="btn btn-primary" onClick={() => {
                            const period = dateRange.start && dateRange.end ? `${dateRange.start} a ${dateRange.end}` : 'Todo';
                            const projName = selectedProject ? state.projects.find(p => p.id === selectedProject)?.name : '';
                            exportExpensesPDF(filteredExpenses, state.projects, CATEGORY_LABELS, formatCurrency, formatDate, period, projName);
                        }} disabled={filteredExpenses.length === 0}
                            style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', borderColor: 'transparent' }}>
                            <FiFileText /> Gastos (PDF)
                        </button>

                        <button className="btn btn-secondary" onClick={() => exportToCSV(agentPerformance, 'comisionistas')} disabled={agentPerformance.length === 0}
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', borderColor: 'transparent' }}>
                            <FiDownload /> Comisionistas (CSV)
                        </button>
                        <button className="btn btn-primary" onClick={() => {
                            const period = dateRange.start && dateRange.end ? `${dateRange.start} a ${dateRange.end}` : 'Todo';
                            const projName = selectedProject ? state.projects.find(p => p.id === selectedProject)?.name : '';
                            exportAgentsPDF(agentPerformance, formatCurrency, period, projName);
                        }} disabled={agentPerformance.length === 0}
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', borderColor: 'transparent' }}>
                            <FiFileText /> Comisionistas (PDF)
                        </button>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiCalendar className="card-title-icon" />
                        Actividad Reciente
                    </h3>
                </div>
                <div className="card-body">
                    {filteredPayments.length === 0 && filteredSales.length === 0 ? (
                        <p className="text-muted text-center">No hay actividad en el periodo seleccionado</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Tipo</th>
                                        <th>Descripción</th>
                                        <th style={{ textAlign: 'right' }}>Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        ...filteredSales.map(s => ({
                                            date: s.createdAt,
                                            type: 'Venta',
                                            description: `${state.projects.find(p => p.id === s.projectId)?.name || ''} - Lote ${s.lotNumber}`,
                                            amount: s.totalPrice,
                                            badgeClass: 'badge-info'
                                        })),
                                        ...filteredPayments.map(p => {
                                            const sale = state.sales.find(s => s.id === p.saleId);
                                            return {
                                                date: p.paymentDate || p.createdAt,
                                                type: 'Pago',
                                                description: `${state.clients.find(c => c.id === sale?.clientId)?.name || state.clients.find(c => c.id === sale?.clientId)?.fullName || ''} - Lote ${sale?.lotNumber || ''}`,
                                                amount: p.amount,
                                                badgeClass: 'badge-success'
                                            };
                                        })
                                    ]
                                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                                        .slice(0, 15)
                                        .map((item, idx) => (
                                            <tr key={idx}>
                                                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(item.date)}</td>
                                                <td>
                                                    <span className={`badge ${item.badgeClass}`}>{item.type}</span>
                                                </td>
                                                <td>{item.description}</td>
                                                <td style={{ fontWeight: '500', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(item.amount)}</td>
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ===== REPORTE MENSUAL DE CARTERA (para Socios) ===== */}
            <div className="card mb-6">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiFileText className="card-title-icon" />
                        Reporte Mensual de Cartera
                    </h3>
                </div>
                <div className="card-body">
                    {/* Month/Year + Project filter */}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0, minWidth: '100px' }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Mes</label>
                            <select className="form-select" value={carteraMonth} onChange={e => setCarteraMonth(e.target.value)}>
                                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                                    <option key={m} value={m}>
                                        {new Date(2024, parseInt(m) - 1).toLocaleString('es-CO', { month: 'long' })}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, minWidth: '90px' }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Año</label>
                            <select className="form-select" value={carteraYear} onChange={e => setCarteraYear(e.target.value)}>
                                {Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i)).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, minWidth: '150px', flex: 1 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Proyecto</label>
                            <select className="form-select" value={carteraProject} onChange={e => setCarteraProject(e.target.value)}>
                                <option value="">Todos</option>
                                {state.projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {(() => {
                        // Build cartera data
                        const monthStart = new Date(`${carteraYear}-${carteraMonth}-01T00:00:00`);
                        const monthEnd = new Date(monthStart);
                        monthEnd.setMonth(monthEnd.getMonth() + 1);
                        monthEnd.setDate(0);
                        monthEnd.setHours(23, 59, 59, 999);

                        const carteraSales = state.sales.filter(s => {
                            if (carteraProject && s.projectId !== carteraProject) return false;
                            return true;
                        });

                        const rows = carteraSales.map(sale => {
                            const client = state.clients.find(c => c.id === sale.clientId);
                            const project = state.projects.find(p => p.id === sale.projectId);
                            const allPayments = state.payments.filter(p => p.saleId === sale.id);
                            const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                            const salePrice = parseFloat(sale.totalPrice || 0);
                            const balance = salePrice - totalPaid;

                            // Payments in selected month
                            const monthPayments = allPayments.filter(p => {
                                const pDate = new Date(p.paymentDate || p.createdAt);
                                return pDate >= monthStart && pDate <= monthEnd;
                            });
                            const paidInMonth = monthPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

                            // Installment info
                            const numInstallments = parseInt(sale.numberOfInstallments || 1);
                            const downPayment = parseFloat(sale.downPayment || 0);
                            const installmentAmount = numInstallments > 1
                                ? (salePrice - downPayment) / numInstallments
                                : salePrice;

                            const paidInstallments = numInstallments > 1
                                ? Math.min(numInstallments, Math.floor((totalPaid - downPayment) / installmentAmount))
                                : (totalPaid >= salePrice ? 1 : 0);
                            const pendingInstallments = Math.max(0, numInstallments - Math.max(0, paidInstallments));

                            return {
                                lotNumber: sale.lotNumber,
                                projectName: project?.name || '',
                                clientName: client?.name || client?.fullName || '',
                                salePrice,
                                totalPaid,
                                balance,
                                installmentAmount: numInstallments > 1 ? installmentAmount : null,
                                pendingInstallments: numInstallments > 1 ? pendingInstallments : '-',
                                paidInMonth,
                            };
                        });

                        const totalPaidInMonth = rows.reduce((sum, r) => sum + r.paidInMonth, 0);
                        const totalBalance = rows.reduce((sum, r) => sum + r.balance, 0);
                        const monthLabel = new Date(`${carteraYear}-${carteraMonth}-01`).toLocaleString('es-CO', { month: 'long', year: 'numeric' });

                        if (rows.length === 0) {
                            return <p className="text-muted text-center">No hay ventas registradas{carteraProject ? ' para este proyecto' : ''}</p>;
                        }

                        return (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Lote</th>
                                                <th>Proyecto</th>
                                                <th>Cliente</th>
                                                <th style={{ textAlign: 'right' }}>Valor Lote</th>
                                                <th style={{ textAlign: 'right' }}>Total Pagado</th>
                                                <th style={{ textAlign: 'right' }}>Saldo</th>
                                                <th style={{ textAlign: 'right' }}>Cuota</th>
                                                <th style={{ textAlign: 'center' }}>Cuotas Pend.</th>
                                                <th style={{ textAlign: 'right', background: '#ecfdf5', color: '#059669' }}>
                                                    Pagado en {monthLabel.split(' ')[0]}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ fontWeight: '600' }}>{row.lotNumber}</td>
                                                    <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>{row.projectName}</td>
                                                    <td>{row.clientName}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatCurrency(row.salePrice)}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>{formatCurrency(row.totalPaid)}</td>
                                                    <td style={{ textAlign: 'right', color: row.balance > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: '500' }}>
                                                        {formatCurrency(row.balance)}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {row.installmentAmount ? formatCurrency(row.installmentAmount) : <span className="badge badge-success">Contado</span>}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {row.pendingInstallments === '-'
                                                            ? <span className="badge badge-success">—</span>
                                                            : row.pendingInstallments === 0
                                                                ? <span className="badge badge-success">Completo</span>
                                                                : <span className="badge badge-warning">{row.pendingInstallments}</span>}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: '600', color: row.paidInMonth > 0 ? '#059669' : 'var(--text-muted)' }}>
                                                        {row.paidInMonth > 0 ? formatCurrency(row.paidInMonth) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: '700' }}>
                                                <td colSpan={5} style={{ textAlign: 'right' }}>Totales:</td>
                                                <td style={{ textAlign: 'right', color: 'var(--color-warning)' }}>{formatCurrency(totalBalance)}</td>
                                                <td></td>
                                                <td></td>
                                                <td style={{ textAlign: 'right', color: '#059669', fontSize: '1.1em' }}>
                                                    {formatCurrency(totalPaidInMonth)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Summary bar */}
                                <div style={{
                                    display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem',
                                    padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)'
                                }}>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recaudado en {monthLabel}</div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#059669' }}>{formatCurrency(totalPaidInMonth)}</div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cartera Total</div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f59e0b' }}>{formatCurrency(totalBalance)}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => {
                                                let csv = `Reporte Mensual de Cartera - ${monthLabel}\n\n`;
                                                csv += 'Lote,Proyecto,Cliente,Valor Lote,Total Pagado,Saldo,Cuota,Cuotas Pendientes,Pagado en Mes\n';
                                                rows.forEach(r => {
                                                    csv += `${r.lotNumber},"${r.projectName}","${r.clientName}",${r.salePrice},${r.totalPaid},${r.balance},${r.installmentAmount || 'Contado'},${r.pendingInstallments},${r.paidInMonth}\n`;
                                                });
                                                csv += `\n,,,,TOTALES,${totalBalance},,,${totalPaidInMonth}\n`;
                                                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `cartera_${carteraYear}_${carteraMonth}.csv`;
                                                a.click();
                                            }}
                                        >
                                            <FiDownload /> Descargar Cartera (CSV)
                                        </button>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}

export default Reports;
