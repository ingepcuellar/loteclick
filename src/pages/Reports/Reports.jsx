import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
    FiFileText,
    FiAlertTriangle
} from 'react-icons/fi';
import {
    exportSalesPDF,
    exportPaymentsPDF,
    exportExpensesPDF,
    exportAgentsPDF,
    exportDesistimientosPDF,
    exportPartnersPDF,
    exportMonthClosePDF,
    exportReportToPDF
} from '../../lib/pdfExporter';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { disbursementService } from '../../services/disbursementService';
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
    const { isPartner, currentUser } = useAuth();

    // Filtrar proyectos según el rol
    const partnerProjectIds = currentUser?.associated_projects || currentUser?.associatedProjects || [];
    const partnerName = (currentUser?.name || '').toLowerCase().trim();
    const visibleProjects = isPartner() && currentUser?.id
        ? state.projects.filter(p => {
            // Mecanismo 1: por associated_projects del perfil
            if (partnerProjectIds.includes(p.id) || partnerProjectIds.includes(String(p.id))) return true;
            // Mecanismo 2: por nombre en el array partners del proyecto
            return (p.partners || []).some(pt =>
                String(pt.id) === String(currentUser.id) ||
                (partnerName && pt.name?.toLowerCase().trim() === partnerName)
            );
        })
        : state.projects;

    const [selectedProject, setSelectedProject] = useState(() =>
        sessionStorage.getItem('reports_project') || ''
    );
    const [dateRange, setDateRange] = useState(() => {
        const saved = sessionStorage.getItem('reports_dateRange');
        return saved ? JSON.parse(saved) : { start: '', end: '' };
    });
    const [zoomLevel, setZoomLevel] = useState(1);
    const [utilityDistrib, setUtilityDistrib] = useState(() => {
        const saved = localStorage.getItem('utility_distrib');
        if (saved) {
            // Ítem 12: migrar etiqueta "Pago Obras" → "Gastos" en registros guardados
            const parsed = JSON.parse(saved);
            const migrated = parsed.map(item =>
                item.label === 'Pago Obras' ? { ...item, label: 'Gastos' } : item
            );
            return migrated;
        }
        return [
            { label: 'Pago Tierra', percentage: 30, color: '#8b5cf6' },
            { label: 'Gastos',      percentage: 30, color: '#3b82f6' },
            { label: 'Socios',      percentage: 40, color: '#10b981' },
        ];
    });

    // Ítem 3 & 14: entregas reales a socios para calcular "Ya Entregado"
    const [realDisbursements, setRealDisbursements] = useState([]);
    useEffect(() => {
        disbursementService.getAll().then(({ data }) => {
            if (data) setRealDisbursements(data);
        }).catch(() => {});
    }, []);

    useEffect(() => { sessionStorage.setItem('reports_project', selectedProject); }, [selectedProject]);
    useEffect(() => { sessionStorage.setItem('reports_dateRange', JSON.stringify(dateRange)); }, [dateRange]);
    useEffect(() => { localStorage.setItem('utility_distrib', JSON.stringify(utilityDistrib)); }, [utilityDistrib]);

    // Desistimientos filtrados
    const filteredDesistimientos = (state.desistimientos || []).filter(d => {
        const matchesProject = !selectedProject || d.project_id === selectedProject;
        const dDate = new Date(d.desistimiento_date || d.created_at);
        const matchesStart = !dateRange.start || dDate >= new Date(dateRange.start);
        const matchesEnd = !dateRange.end || dDate <= new Date(dateRange.end + 'T23:59:59');
        return matchesProject && matchesStart && matchesEnd;
    });
    const totalDesistimientosRetained = filteredDesistimientos.reduce((sum, d) => sum + parseFloat(d.amount_retained || 0), 0);

    // Month selector for cartera report (defaults to current month)
    const now = new Date();
    const [carteraMonth, setCarteraMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
    const [carteraYear, setCarteraYear] = useState(String(now.getFullYear()));
    const [carteraProject, setCarteraProject] = useState('');

    const stats = getStats();

    // El dashboard se muestra con solo fechas seleccionadas (proyecto es opcional para el dashboard)
    const filtersReady = !!(dateRange.start && dateRange.end);
    // Algunas secciones (socios, cartera) siguen requiriendo proyecto específico
    const filtersReadyWithProject = !!(selectedProject && dateRange.start && dateRange.end);



    // Extract YYYY-MM-DD from any date value (Date obj, ISO string, MySQL "YYYY-MM-DD HH:MM:SS")
    // Comparing as strings avoids UTC-midnight timezone offset bugs entirely.
    const toDateStr = (val) => String(val || '').substring(0, 10);

    // Filter data based on project and date
    const filterByDateAndProject = (items, dateField = 'createdAt') => {
        return items.filter(item => {
            const matchesProject = !selectedProject || item.projectId === selectedProject;
            const d = toDateStr(item[dateField]);
            const matchesStart = !dateRange.start || d >= dateRange.start;
            const matchesEnd = !dateRange.end || d <= dateRange.end;
            return matchesProject && matchesStart && matchesEnd;
        });
    };

    // Ventas activas: excluir desistidas de los cálculos financieros del período
    const filteredSales = filterByDateAndProject(state.sales).filter(
        s => (s.status || 'active') !== 'desistida'
    );

    const filteredPayments = state.payments.filter(p => {
        const sale = state.sales.find(s => s.id === p.saleId);
        if (!sale) return false;
        const matchesProject = !selectedProject || sale.projectId === selectedProject;
        const d = toDateStr(p.paymentDate || p.createdAt);
        const matchesStart = !dateRange.start || d >= dateRange.start;
        const matchesEnd = !dateRange.end || d <= dateRange.end;
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
            ? visibleProjects.filter(p => p.id === selectedProject)
            : visibleProjects;
        const allLots = projects.flatMap(p => p.lots || []);
        return {
            // sold = number of active sales (consistent with Ventas card)
            sold: filteredSales.length,
            available: allLots.filter(l => l.status === 'available').length,
            reserved: allLots.filter(l => l.status === 'reserved' || l.status === 'pending_initial').length,
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

    // Partners distribution — calcula sobre utilidad neta (ingresos - gastos del período)
    const getPartnerDistribution = () => {
        if (!selectedProject) return [];
        const project = state.projects.find(p => p.id === selectedProject);
        if (!project?.partners?.length) return [];

        // Ingresos recaudados del proyecto en el período (ya filtrados en filteredPayments)
        const projectIncome = filteredPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        // Gastos del proyecto en el período (ya filtrados en filteredExpenses)
        const projectExpenses = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        // Base: utilidad neta del período
        const netBase = Math.max(0, projectIncome - projectExpenses);

        return project.partners.map(partner => {
            // Entregas del PERÍODO seleccionado (filtradas por fecha y proyecto)
            const entregadoPeriodo = realDisbursements
                .filter(d => {
                    const pid = d.partner_id || d.partnerId;
                    const projId = d.project_id || d.projectId;
                    const dDate = (d.disbursement_date || d.disbursementDate || d.createdAt || '').substring(0, 10);
                    const matchPartner = pid === partner.user_id || pid === partner.userId || pid === partner.id;
                    const matchProject = projId === selectedProject;
                    const matchStart = !dateRange.start || dDate >= dateRange.start;
                    const matchEnd = !dateRange.end || dDate <= dateRange.end;
                    return matchPartner && matchProject && matchStart && matchEnd;
                })
                .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);

            // Ítem 13: gastos etiquetados a este socio en el período
            const expensesPaid = filteredExpenses
                .filter(e => {
                    const eid = e.partnerId || e.partner_id;
                    return eid && (eid === partner.user_id || eid === partner.userId || eid === partner.id);
                })
                .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

            const entitled = netBase * (partner.percentage / 100);
            const totalDeliveredPeriod = entregadoPeriodo + expensesPaid;
            const remaining = Math.max(0, entitled - totalDeliveredPeriod);

            return {
                name: partner.name,
                percentage: partner.percentage,
                amount: entitled,              // total que le corresponde
                entregadoPeriodo,              // entregas formales del período
                expensesPaid: totalDeliveredPeriod,
                expensesCharged: expensesPaid,
                remaining,
                grossIncome: projectIncome,
                totalExpenses: projectExpenses,
                netBase,
            };
        });
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
                    projects: new Set(),
                    lots: []  // Track lot numbers
                };
            }

            agentMap[agentName].salesCount += 1;
            agentMap[agentName].totalRevenue += parseFloat(sale.totalPrice || 0);
            agentMap[agentName].commissionTotal += parseFloat(sale.commissionAmount || sale.commission_amount || 0);

            // Add lot info
            const lotLabel = sale.lotNumber || sale.lot_number || '-';
            const proj = state.projects.find(p => p.id === sale.projectId);
            agentMap[agentName].lots.push(`${proj?.name ? proj.name + ' - ' : ''}Lote ${lotLabel}`);

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
        return visibleProjects.map(project => {
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

    // Devoluciones de desistimientos — SOLO INFORMATIVO, no restan la utilidad
    const totalDevueltoDesistimientos = filteredDesistimientos.reduce((sum, d) => {
        const retained = parseFloat(d.amount_retained || 0);
        const totalPaid = parseFloat(d.total_paid || 0);
        return sum + Math.max(0, totalPaid - retained);
    }, 0);

    // Utilidad Neta = Recaudo - Gastos Operativos (desistimientos son informativos)
    const netProfit = filteredTotalPayments - filteredTotalExpenses;

    // Cierre de Mes (Month Data)
    const monthData = {
        salesAmount:           filteredTotalSales,
        paymentsAmount:        filteredTotalPayments,
        expensesAmount:        filteredTotalExpenses,
        devolucionesAmount:    totalDevueltoDesistimientos,  // informativo
        desistimientosCount:   filteredDesistimientos.length,
        commissionsAmount:     totalCommissions,
        retainedAmount:        totalDesistimientosRetained,
        netProfit,
        lotsSold:              filteredSales.length
    };


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
            // Ítem 2: incluir modalidad de pago en CSV
            csv = 'Fecha,Cliente,Documento,Proyecto,Lote,Monto,Modalidad\n';
            filteredPayments.forEach(payment => {
                const sale = state.sales.find(s => s.id === payment.saleId || s.id === payment.sale_id);
                const client = sale ? state.clients.find(c => c.id === sale.clientId || c.id === sale.client_id) : null;
                const project = sale ? state.projects.find(p => p.id === sale.projectId || p.id === sale.project_id) : null;
                const metodoPago = (payment.paymentMethod || payment.payment_method) === 'transfer' ? 'Transferencia' : 'Efectivo';
                csv += `${formatDate(payment.paymentDate || payment.payment_date || payment.createdAt)},${client?.name || client?.fullName || ''},${client?.document || ''},${project?.name || ''},${sale?.lotNumber || sale?.lot_number || ''},${payment.amount},${metodoPago}\n`;
            });
            // Resumen de totales por modalidad al final del archivo
            const csvTotalEfectivo = filteredPayments
                .filter(p => (p.paymentMethod || p.payment_method || 'cash') !== 'transfer')
                .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
            const csvTotalTransferencia = filteredPayments
                .filter(p => (p.paymentMethod || p.payment_method) === 'transfer')
                .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
            const csvTotalGeneral = filteredPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
            const csvCountEfectivo = filteredPayments.filter(p => (p.paymentMethod || p.payment_method || 'cash') !== 'transfer').length;
            const csvCountTransferencia = filteredPayments.filter(p => (p.paymentMethod || p.payment_method) === 'transfer').length;
            csv += `\n,,,,,,\n`;
            csv += `RESUMEN POR MODALIDAD,,,,,,\n`;
            csv += `Modalidad,Cantidad de Pagos,,,, Total,\n`;
            csv += `Efectivo,${csvCountEfectivo},,,,${csvTotalEfectivo},\n`;
            csv += `Transferencia,${csvCountTransferencia},,,,${csvTotalTransferencia},\n`;
            csv += `TOTAL GENERAL,${filteredPayments.length},,,,${csvTotalGeneral},\n`;
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
        } else if (filename === 'desistimientos') {
            csv = 'Fecha,Proyecto,Lote,Cliente,Pagado,Retenido,Devuelto\n';
            filteredDesistimientos.forEach(d => {
                const proj = state.projects.find(p => p.id === d.project_id);
                const client = state.clients.find(c => c.id === d.client_id);
                const retained = parseFloat(d.amount_retained || 0);
                const returned = parseFloat(d.amount_returned || 0);
                const totalPaid = retained + returned;
                csv += `${formatDate(d.desistimiento_date || d.created_at)},${proj?.name || ''},${d.lot_number || ''},${client?.name || client?.fullName || ''},${totalPaid},${retained},${returned}\n`;
            });
        } else if (filename === 'entregas_socios') {
            csv = 'Socio,Porcentaje,Monto\n';
            partnerDistribution.forEach(p => {
                csv += `"${p.name}",${p.percentage}%,${p.amount}\n`;
            });
        } else if (filename === 'cierre_de_mes') {
            csv = 'Indicador,Valor\n';
            csv += `Total Ventas Nuevas,${monthData.salesAmount}\n`;
            csv += `Total Recaudo,${monthData.paymentsAmount}\n`;
            csv += `Total Gastos Operativos,${monthData.expensesAmount}\n`;
            csv += `Total Comisiones,${monthData.commissionsAmount}\n`;
            csv += `Total Retenciones (Desistimientos),${monthData.retainedAmount}\n`;
            csv += `Utilidad Neta,${monthData.netProfit}\n`;
            csv += `Lotes Vendidos,${monthData.lotsSold}\n`;
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };


    // Stat card component
    const StatCard = ({ icon: Icon, label, value, color, subtext }) => (
        <div className="card" style={{ minWidth: 0 }}>
            <div className="stat-card">
                <div className="stat-icon" style={{ background: color || 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))' }}>
                    <Icon />
                </div>
                <div className="stat-content" style={{ overflow: 'hidden', minWidth: 0 }}>
                    <h3 style={{
                        fontSize: 'clamp(0.85rem, 1.5vw, 1.35rem)',
                        letterSpacing: '-0.3px',
                        wordBreak: 'break-word',
                        lineHeight: '1.2',
                        whiteSpace: 'normal'
                    }}>{value}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{label}</p>
                    {subtext && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>{subtext}</span>}
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
                {/* Zoom Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                    <button
                        type="button"
                        onClick={() => setZoomLevel(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}
                        title="Alejar"
                    >−</button>
                    <input
                        type="range" min="0.5" max="1.5" step="0.05"
                        value={zoomLevel}
                        onChange={e => setZoomLevel(parseFloat(e.target.value))}
                        style={{ width: '80px', accentColor: 'var(--color-primary-500)' }}
                    />
                    <button
                        type="button"
                        onClick={() => setZoomLevel(z => Math.min(1.5, parseFloat((z + 0.1).toFixed(1))))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}
                        title="Acercar"
                    >+</button>
                    <span
                        style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', minWidth: '34px', textAlign: 'center' }}
                    >{Math.round(zoomLevel * 100)}%</span>
                    {zoomLevel !== 1 && (
                        <button
                            type="button"
                            onClick={() => setZoomLevel(1)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--text-muted)', padding: '2px 4px' }}
                            title="Restablecer"
                        >↺</button>
                    )}
                </div>
            </div>

            {/* Zoomable content wrapper */}
            <div style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease',
                // Ajustar espacio ocupado segun el zoom para no dejar espacio en blanco
                marginBottom: zoomLevel < 1 ? `calc((${zoomLevel} - 1) * 100vh)` : 0,
            }}>

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
                            {visibleProjects.map(p => (
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
                            onChange={(e) => {
                                // Ítem 4e: al seleccionar fecha fin, aplica automáticamente
                                setDateRange(prev => ({ ...prev, end: e.target.value }));
                            }}
                        />
                    </div>

                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            setSelectedProject('');
                            setDateRange({ start: '', end: '' });
                            sessionStorage.removeItem('reports_project');
                            sessionStorage.removeItem('reports_dateRange');
                        }}
                    >
                        Limpiar
                    </button>
                </div>
            </div>

            {/* Ítem 4d: Banner de período activo cuando hay filtros aplicados */}
            {(dateRange.start || dateRange.end || selectedProject) && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(79,70,229,0.06))',
                    border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: 'var(--radius-lg)', padding: '0.6rem 1rem',
                    marginBottom: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)'
                }}>
                    <FiCalendar style={{ color: 'var(--color-primary-400)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-muted)' }}>Viendo:</span>
                    {selectedProject && (
                        <span className="badge badge-info">
                            📂 {visibleProjects.find(p => p.id === selectedProject)?.name || 'Proyecto'}
                        </span>
                    )}
                    {dateRange.start && (
                        <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--color-primary-300)' }}>
                            📅 Desde: {new Date(dateRange.start + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                    )}
                    {dateRange.end && (
                        <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--color-primary-300)' }}>
                            📅 Hasta: {new Date(dateRange.end + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                    )}
                    {!dateRange.start && !dateRange.end && (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin filtro de fechas</span>
                    )}
                </div>
            )}

            {/* ===== EMPTY STATE: requiere fecha inicio + fecha fin ===== */}
            {!filtersReady && (
                <div className="card mb-6" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                    <h3 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Selecciona el rango de fechas para ver el reporte</h3>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto' }}>
                        Elige una <strong>Fecha Inicio</strong> y <strong>Fecha Fin</strong> en los filtros de arriba para ver la información detallada.
                        Opcionalmente filtra por <strong>Proyecto</strong>.
                    </p>
                </div>
            )}

            {/* ===== KPI CARDS (responsive grid) ===== */}
            {filtersReady && (() => {
                // Desglose por modalidad de pago
                const totalEfectivo = filteredPayments
                    .filter(p => (p.paymentMethod || p.payment_method || 'cash') !== 'transfer')
                    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                const totalTransferencia = filteredPayments
                    .filter(p => (p.paymentMethod || p.payment_method) === 'transfer')
                    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                const countEfectivo = filteredPayments.filter(p => (p.paymentMethod || p.payment_method || 'cash') !== 'transfer').length;
                const countTransferencia = filteredPayments.filter(p => (p.paymentMethod || p.payment_method) === 'transfer').length;

                return (
                <>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 'var(--spacing-4)',
                    marginBottom: 'var(--spacing-4)'
                }}>
                    <StatCard icon={FiShoppingCart} label="Ventas" value={filteredSales.length} color="linear-gradient(135deg, #6366f1, #4f46e5)" />
                    <StatCard icon={FiTrendingUp} label="Total Vendido" value={formatCurrency(filteredTotalSales)} color="linear-gradient(135deg, #2d6a4f, #40916c)" />
                    <StatCard icon={FiDollarSign} label="Recaudado Total" value={formatCurrency(filteredTotalPayments)} color="linear-gradient(135deg, #0891b2, #06b6d4)" subtext={`${filteredPayments.length} pagos`} />
                    <StatCard icon={FiDollarSign} label="Cartera" value={formatCurrency(filteredPending)} color="linear-gradient(135deg, #d97706, #f59e0b)" subtext="Pendiente por cobrar" />
                    <StatCard icon={FiMap} label="Lotes Vendidos" value={lotCounts.sold} color="linear-gradient(135deg, #059669, #10b981)" subtext={`de ${lotCounts.total} totales`} />
                    <StatCard icon={FiMapPin} label="Lotes Disponibles" value={lotCounts.available} color="linear-gradient(135deg, #7c3aed, #8b5cf6)" />
                    <StatCard icon={FiDollarSign} label="Total Gastos" value={formatCurrency(filteredTotalExpenses)} color="linear-gradient(135deg, #ef4444, #dc2626)" />
                    <StatCard icon={FiAlertTriangle} label="Desistimientos" value={formatCurrency(totalDesistimientosRetained)} color="linear-gradient(135deg, #f59e0b, #d97706)" subtext={`${filteredDesistimientos.length} registro${filteredDesistimientos.length !== 1 ? 's' : ''}`} />
                    <StatCard icon={FiTrendingUp} label="Utilidad" value={formatCurrency(netProfit)} color={netProfit >= 0 ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #ef4444, #dc2626)'} subtext="Recaudado − Gastos" />
                </div>

                {/* ===== DESGLOSE DE RECAUDO POR MODALIDAD ===== */}
                {filteredPayments.length > 0 && (
                <div className="card mb-6">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiDollarSign className="card-title-icon" />
                            Recaudo por Modalidad de Pago
                        </h3>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                            Total: <strong style={{ color: 'var(--color-primary-400)' }}>{formatCurrency(filteredTotalPayments)}</strong>
                        </span>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                            {/* Efectivo */}
                            <div style={{
                                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)',
                                padding: '1.25rem', borderLeft: '4px solid #10b981'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>💵 Efectivo</span>
                                    <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>{countEfectivo} pagos</span>
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: '#10b981' }}>
                                    {formatCurrency(totalEfectivo)}
                                </div>
                                <div style={{ marginTop: '0.5rem', height: '4px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${filteredTotalPayments > 0 ? (totalEfectivo / filteredTotalPayments) * 100 : 0}%`,
                                        height: '100%', background: '#10b981', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease'
                                    }} />
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {filteredTotalPayments > 0 ? ((totalEfectivo / filteredTotalPayments) * 100).toFixed(1) : 0}% del total recaudado
                                </div>
                            </div>

                            {/* Transferencia */}
                            <div style={{
                                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)',
                                padding: '1.25rem', borderLeft: '4px solid #3b82f6'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>🏦 Transferencia</span>
                                    <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>{countTransferencia} pagos</span>
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: '#3b82f6' }}>
                                    {formatCurrency(totalTransferencia)}
                                </div>
                                <div style={{ marginTop: '0.5rem', height: '4px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${filteredTotalPayments > 0 ? (totalTransferencia / filteredTotalPayments) * 100 : 0}%`,
                                        height: '100%', background: '#3b82f6', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease'
                                    }} />
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {filteredTotalPayments > 0 ? ((totalTransferencia / filteredTotalPayments) * 100).toFixed(1) : 0}% del total recaudado
                                </div>
                            </div>

                            {/* Barra comparativa combinada */}
                            <div style={{
                                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)',
                                padding: '1.25rem', borderLeft: '4px solid #8b5cf6'
                            }}>
                                <div style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>📊 Distribución</div>
                                <div style={{ height: '24px', borderRadius: 'var(--radius-full)', overflow: 'hidden', display: 'flex', marginBottom: '0.75rem' }}>
                                    <div style={{
                                        width: `${filteredTotalPayments > 0 ? (totalEfectivo / filteredTotalPayments) * 100 : 0}%`,
                                        background: '#10b981', transition: 'width 0.5s ease'
                                    }} />
                                    <div style={{
                                        width: `${filteredTotalPayments > 0 ? (totalTransferencia / filteredTotalPayments) * 100 : 0}%`,
                                        background: '#3b82f6', transition: 'width 0.5s ease'
                                    }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                                    <span style={{ color: '#10b981' }}>● Efectivo {filteredTotalPayments > 0 ? ((totalEfectivo / filteredTotalPayments) * 100).toFixed(1) : 0}%</span>
                                    <span style={{ color: '#3b82f6' }}>Transferencia {filteredTotalPayments > 0 ? ((totalTransferencia / filteredTotalPayments) * 100).toFixed(1) : 0}% ●</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                )}
                </>
                );
            })()}

            {/* ===== CIERRE DE MES GERENCIAL ===== */}
            {filtersReady && (
            <div className="card mb-6">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiBarChart2 className="card-title-icon" />
                        Cierre de Mes — Informe Gerencial
                    </h3>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {dateRange.start && dateRange.end
                            ? `${new Date(dateRange.start + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })} — ${new Date(dateRange.end + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`
                            : 'Período seleccionado'}
                    </span>
                </div>
                <div className="card-body">

                    {/* Fila 1: Recaudo → Gastos → Utilidad (3 cards) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>

                        {/* Recaudo */}
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💰 Recaudo del período</div>
                            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: '#10b981' }}>{formatCurrency(filteredTotalPayments)}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>{filteredPayments.length} pago(s) recibido(s)</div>
                        </div>

                        {/* Gastos operativos */}
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Gastos operativos</div>
                            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: '#ef4444' }}>{formatCurrency(filteredTotalExpenses)}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>{filteredExpenses.length} gasto(s) registrado(s)</div>
                        </div>

                        {/* Utilidad Neta */}
                        <div style={{
                            background: netProfit >= 0
                                ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.06))'
                                : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(220,38,38,0.06))',
                            borderRadius: 'var(--radius-lg)', padding: '1.25rem',
                            border: `2px solid ${netProfit >= 0 ? '#10b981' : '#ef4444'}`
                        }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                ⚡ Utilidad Neta
                            </div>
                            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: netProfit >= 0 ? '#10b981' : '#ef4444' }}>
                                {formatCurrency(netProfit)}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Recaudo − Gastos Operativos
                            </div>
                        </div>
                    </div>

                    {/* Desistimientos — INFORMATIVO (no afecta utilidad) */}
                    {filteredDesistimientos.length > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
                        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
                        borderRadius: 'var(--radius-md)', padding: '0.6rem 1rem', marginBottom: '1rem',
                        fontSize: 'var(--font-size-sm)'
                    }}>
                        <span style={{ color: '#f59e0b', fontWeight: '600' }}>↩️ Desistimientos del período (informativo)</span>
                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{filteredDesistimientos.length} desistimiento(s)</span>
                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                        <span>Devuelto al cliente: <strong style={{ color: '#f59e0b' }}>{formatCurrency(totalDevueltoDesistimientos)}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                        <span>Retenido empresa: <strong style={{ color: '#10b981' }}>{formatCurrency(totalDesistimientosRetained)}</strong></span>
                    </div>
                    )}

                    {/* Fórmula visual */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
                        background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                        padding: '0.6rem 1rem', marginBottom: '1.5rem',
                        fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)'
                    }}>
                        <span style={{ color: '#10b981', fontWeight: '600' }}>{formatCurrency(filteredTotalPayments)}</span>
                        <span>(Recaudo)</span>
                        <span>−</span>
                        <span style={{ color: '#ef4444', fontWeight: '600' }}>{formatCurrency(filteredTotalExpenses)}</span>
                        <span>(Gastos)</span>
                        <span>=</span>
                        <span style={{ color: netProfit >= 0 ? '#10b981' : '#ef4444', fontWeight: '700' }}>{formatCurrency(netProfit)} Utilidad Neta</span>
                    </div>

                    {/* Tabla de socios */}
                    {partnerDistribution.length > 0 && (
                    <>
                        <div style={{ fontWeight: '600', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            👥 Distribución por Socio
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Socio</th>
                                        <th style={{ textAlign: 'center' }}>%</th>
                                        <th style={{ textAlign: 'right' }}>Le corresponde</th>
                                        <th style={{ textAlign: 'right' }}>Ya entregado (período)</th>
                                        <th style={{ textAlign: 'right' }}>Pendiente</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {partnerDistribution.map((partner, idx) => {
                                        const leCorresponde = partner.amount;
                                        const entregado = partner.entregadoPeriodo || 0;
                                        const pendiente = Math.max(0, leCorresponde - entregado);
                                        return (
                                            <tr key={idx}>
                                                <td style={{ fontWeight: '600' }}>{partner.name}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className="badge badge-info">{partner.percentage}%</span>
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--color-primary-400)' }}>
                                                    {formatCurrency(leCorresponde)}
                                                </td>
                                                <td style={{ textAlign: 'right', color: '#10b981', fontWeight: '600' }}>
                                                    {formatCurrency(entregado)}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: '600', color: pendiente > 0 ? '#f59e0b' : '#10b981' }}>
                                                    {formatCurrency(pendiente)}
                                                    {pendiente <= 0 && <span style={{ fontSize: '0.7rem', marginLeft: '4px' }}>✓ Al día</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: '700' }}>
                                        <td>Total</td>
                                        <td style={{ textAlign: 'center' }}>100%</td>
                                        <td style={{ textAlign: 'right', color: 'var(--color-primary-400)' }}>
                                            {formatCurrency(netProfit)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#10b981' }}>
                                            {formatCurrency(partnerDistribution.reduce((s, p) => s + (p.entregadoPeriodo || 0), 0))}
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#f59e0b' }}>
                                            {formatCurrency(partnerDistribution.reduce((s, p) => s + Math.max(0, p.amount - (p.entregadoPeriodo || 0)), 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </>
                    )}

                    {partnerDistribution.length === 0 && selectedProject && (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0', fontSize: 'var(--font-size-sm)' }}>
                            Este proyecto no tiene socios registrados
                        </p>
                    )}
                    {!selectedProject && (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0', fontSize: 'var(--font-size-sm)' }}>
                            💡 Selecciona un proyecto específico para ver la distribución por socios
                        </p>
                    )}

                </div>
            </div>
            )}

            {/* ===== DISTRIBUCIÓN SUGERIDA DE UTILIDAD ===== */}
            {filtersReady && netProfit > 0 && (

            <div className="card mb-6">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiTrendingUp className="card-title-icon" />
                        Distribución Sugerida de la Utilidad
                    </h3>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                        Utilidad disponible: <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(netProfit)}</strong>
                    </span>
                </div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                        {utilityDistrib.map((item, idx) => {
                            const amount = netProfit * (item.percentage / 100);
                            return (
                                <div key={idx} style={{
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '1rem',
                                    borderLeft: `4px solid ${item.color}`,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: '600' }}>{item.label}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <input
                                                type="number" min="0" max="100" step="1"
                                                value={item.percentage}
                                                onChange={e => {
                                                    const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                                                    setUtilityDistrib(prev => prev.map((it, i) => i === idx ? { ...it, percentage: val } : it));
                                                }}
                                                style={{
                                                    width: '52px', textAlign: 'center', padding: '2px 4px',
                                                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                                    fontSize: 'var(--font-size-sm)'
                                                }}
                                            />
                                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>%</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: item.color }}>
                                        {formatCurrency(amount)}
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {item.percentage}% de {formatCurrency(netProfit)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {Math.abs(utilityDistrib.reduce((s, i) => s + i.percentage, 0) - 100) > 0.01 && (
                        <p style={{ color: '#ef4444', fontSize: 'var(--font-size-sm)', textAlign: 'center', margin: 0 }}>
                            ⚠️ Los porcentajes suman {utilityDistrib.reduce((s, i) => s + i.percentage, 0)}% — deben sumar 100%
                        </p>
                    )}
                </div>
            </div>
            )}

            {/* ===== EXPENSE BREAKDOWN BY CATEGORY ===== */}
            {filtersReady && <div className="card mb-6">
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
            </div>}

            {/* ===== DISTRIBUCIÓN POR SOCIOS (datos reales sobre utilidad neta) ===== */}
            {filtersReady && (
            <div className="card mb-6">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiUsers className="card-title-icon" />
                        Distribución por Socios
                    </h3>
                    {partnerDistribution.length > 0 && (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            Base: Utilidad neta del período
                        </span>
                    )}
                </div>
                <div className="card-body">
                    {partnerDistribution.length === 0 ? (
                        <p className="text-muted text-center">Este proyecto no tiene socios registrados</p>
                    ) : (
                        <>
                            {/* Resumen financiero */}
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--font-size-sm)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Ingresos recaudados: <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(partnerDistribution[0]?.grossIncome || 0)}</strong></span>
                                <span style={{ color: 'var(--text-muted)' }}>Gastos del período: <strong style={{ color: '#ef4444' }}>{formatCurrency(partnerDistribution[0]?.totalExpenses || 0)}</strong></span>
                                <span style={{ color: 'var(--text-muted)' }}>Utilidad base: <strong style={{ color: 'var(--color-primary-400)' }}>{formatCurrency(partnerDistribution[0]?.netBase || 0)}</strong></span>
                            </div>
                            <div className="flex flex-col gap-4">
                                {partnerDistribution.map((partner, idx) => (
                                    <div key={idx} style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-4)' }}>
                                        <div className="flex-between mb-2">
                                            <div style={{ fontWeight: '600' }}>{partner.name}</div>
                                            <span className="badge badge-info">{partner.percentage}%</span>
                                        </div>
                                        {/* Three-column breakdown */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                                            <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '2px' }}>Total Corresponde</div>
                                                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: '700', color: 'var(--color-primary-400)' }}>{formatCurrency(partner.amount)}</div>
                                            </div>
                                            <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(34,197,94,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(34,197,94,0.2)' }}>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '2px' }}>Ya Entregado</div>
                                                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(partner.expensesPaid || 0)}</div>
                                                {/* Detalle: entregas formales vs gastos directos */}
                                                {partner.realDelivered > 0 && (
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                        Entregas: {formatCurrency(partner.realDelivered)}
                                                    </div>
                                                )}
                                                {partner.expensesCharged > 0 && (
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                        Gastos directos: {formatCurrency(partner.expensesCharged)}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '2px' }}>Pendiente de Entregar</div>
                                                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: '700', color: '#b45309' }}>{formatCurrency(partner.remaining ?? partner.amount)}</div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '6px' }}>
                                            {partner.percentage}% de utilidad neta {formatCurrency(partner.netBase)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
            )}

            {/* === Reporte por Comisionista eliminado por solicitud del cliente === */}
            {false && <div className="card mb-6">
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
                                        <th>Lotes</th>
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
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                                    {agent.projects.join(', ')}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', maxWidth: '180px' }}>
                                                    {(agent.lots || []).map((l, i) => (
                                                        <div key={i} style={{ whiteSpace: 'nowrap' }}>{l}</div>
                                                    ))}
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
            </div>}

            {/* Export Options */}
            <div className="card mb-6">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiDownload className="card-title-icon" />
                        Centro de Reportes y Exportación
                    </h3>
                </div>
                <div className="card-body">
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--spacing-6)' }}>
                        Selecciona el tipo de reporte a exportar. Los datos corresponden al <strong>Proyecto</strong> y <strong>Rango de Fechas</strong> filtrado en la parte superior.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                        
                        {/* 1. Ventas */}
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-4)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    <FiShoppingCart />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontWeight: '600' }}>Ventas Registradas</h4>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filteredSales.length} registros</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                <button className="btn btn-secondary flex-1" onClick={() => exportToCSV(filteredSales, 'ventas')} disabled={filteredSales.length === 0} style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                                    <FiDownload /> CSV
                                </button>
                                <button className="btn btn-primary flex-1" onClick={() => {
                                    const period = dateRange.start && dateRange.end ? `${dateRange.start} a ${dateRange.end}` : 'Todo';
                                    const projName = selectedProject ? state.projects.find(p => p.id === selectedProject)?.name : '';
                                    exportSalesPDF(filteredSales, state.clients, state.projects, getPaymentsBySale, formatCurrency, formatDate, period, projName);
                                }} disabled={filteredSales.length === 0} style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                                    <FiFileText /> PDF
                                </button>
                            </div>
                        </div>

                        {/* 2. Pagos */}
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-4)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    <FiDollarSign />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontWeight: '600' }}>Recaudos y Pagos</h4>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filteredPayments.length} registros</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                <button className="btn btn-secondary flex-1" onClick={() => exportToCSV(filteredPayments, 'pagos')} disabled={filteredPayments.length === 0} style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                                    <FiDownload /> CSV
                                </button>
                                <button className="btn btn-primary flex-1" onClick={() => {
                                    const period = dateRange.start && dateRange.end ? `${dateRange.start} a ${dateRange.end}` : 'Todo';
                                    const projName = selectedProject ? state.projects.find(p => p.id === selectedProject)?.name : '';
                                    exportPaymentsPDF(filteredPayments, state.sales, state.clients, state.projects, formatCurrency, formatDate, period, projName);
                                }} disabled={filteredPayments.length === 0} style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                                    <FiFileText /> PDF
                                </button>
                            </div>
                        </div>

                        {/* 3. Gastos */}
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-4)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    <FiDollarSign />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontWeight: '600' }}>Gastos Operativos</h4>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filteredExpenses.length} registros</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                <button className="btn btn-secondary flex-1" onClick={() => exportToCSV(filteredExpenses, 'gastos')} disabled={filteredExpenses.length === 0} style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                                    <FiDownload /> CSV
                                </button>
                                <button className="btn btn-primary flex-1" onClick={() => {
                                    const period = dateRange.start && dateRange.end ? `${dateRange.start} a ${dateRange.end}` : 'Todo';
                                    const projName = selectedProject ? state.projects.find(p => p.id === selectedProject)?.name : '';
                                    exportExpensesPDF(filteredExpenses, state.projects, CATEGORY_LABELS, formatCurrency, formatDate, period, projName);
                                }} disabled={filteredExpenses.length === 0} style={{ padding: '0.5rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', borderColor: 'transparent' }}>
                                    <FiFileText /> PDF
                                </button>
                            </div>
                        </div>

                        {/* Comisionistas eliminado por solicitud del cliente */}

                        {/* 5. Desistimientos */}
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-4)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    <FiAlertTriangle />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontWeight: '600' }}>Desistimientos</h4>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filteredDesistimientos.length} registros</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                <button className="btn btn-secondary flex-1" onClick={() => exportToCSV(filteredDesistimientos, 'desistimientos')} disabled={filteredDesistimientos.length === 0} style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                                    <FiDownload /> CSV
                                </button>
                                <button className="btn btn-primary flex-1" onClick={() => {
                                    const period = dateRange.start && dateRange.end ? `${dateRange.start} a ${dateRange.end}` : 'Todo';
                                    const projName = selectedProject ? state.projects.find(p => p.id === selectedProject)?.name : '';
                                    exportDesistimientosPDF(filteredDesistimientos, state.projects, state.clients, formatCurrency, formatDate, period, projName);
                                }} disabled={filteredDesistimientos.length === 0} style={{ padding: '0.5rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #d97706, #b45309)', borderColor: 'transparent' }}>
                                    <FiFileText /> PDF
                                </button>
                            </div>
                        </div>

                        {/* 6. Entregas a Socios */}
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-4)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    <FiUsers />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontWeight: '600' }}>Entregas a Socios</h4>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{partnerDistribution.length} registros</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                <button className="btn btn-secondary flex-1" onClick={() => exportToCSV(partnerDistribution, 'entregas_socios')} disabled={partnerDistribution.length === 0} style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                                    <FiDownload /> CSV
                                </button>
                                <button className="btn btn-primary flex-1" onClick={() => {
                                    const period = dateRange.start && dateRange.end ? `${dateRange.start} a ${dateRange.end}` : 'Todo';
                                    const projName = selectedProject ? state.projects.find(p => p.id === selectedProject)?.name : '';
                                    exportPartnersPDF(partnerDistribution, formatCurrency, period, projName);
                                }} disabled={partnerDistribution.length === 0} style={{ padding: '0.5rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #059669, #047857)', borderColor: 'transparent' }}>
                                    <FiFileText /> PDF
                                </button>
                            </div>
                        </div>

                        {/* 7. Cierre de Mes (Consolidado) */}
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-4)', display: 'flex', flexDirection: 'column', gap: '1rem', border: '2px solid var(--color-primary-500)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    <FiBarChart2 />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontWeight: '600' }}>Cierre de Mes</h4>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Consolidado gerencial</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                <button className="btn btn-secondary flex-1" onClick={() => exportToCSV({}, 'cierre_de_mes')} style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                                    <FiDownload /> CSV
                                </button>
                                <button className="btn btn-primary flex-1" onClick={() => {
                                    const period = dateRange.start && dateRange.end ? `${dateRange.start} a ${dateRange.end}` : 'Todo';
                                    const projName = selectedProject ? state.projects.find(p => p.id === selectedProject)?.name : '';
                                    // Enriquecer partnerDistribution con entregadoPeriodo (desembolsos del rango)
                                    const enrichedPartners = partnerDistribution.map(partner => {
                                        const entregadoPeriodo = realDisbursements
                                            .filter(d => {
                                                const pid = d.partner_id || d.partnerId;
                                                const projId = d.project_id || d.projectId;
                                                const dDate = (d.disbursement_date || d.disbursementDate || '').substring(0, 10);
                                                const matchProject = !selectedProject || projId === selectedProject;
                                                const matchStart = !dateRange.start || dDate >= dateRange.start;
                                                const matchEnd = !dateRange.end || dDate <= dateRange.end;
                                                return (pid === partner.user_id || pid === partner.userId || pid === partner.id)
                                                    && matchProject && matchStart && matchEnd;
                                            })
                                            .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
                                        return { ...partner, entregadoPeriodo };
                                    });
                                    exportMonthClosePDF(monthData, enrichedPartners, formatCurrency, period, projName);
                                }} style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                                    <FiFileText /> PDF
                                </button>
                            </div>
                        </div>

                        {/* Ítem 6: Reporte por Socios */}
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-4)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    <FiMap />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontWeight: '600' }}>Socios por Proyecto</h4>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{partnerDistribution.length} socios en el proyecto</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                <button className="btn btn-secondary flex-1" onClick={() => {
                                    // Ítem 6: CSV Socios por proyecto
                                    if (!selectedProject) { alert('Selecciona un proyecto primero'); return; }
                                    const projName = state.projects.find(p => p.id === selectedProject)?.name || '';
                                    let csv = `Proyecto: ${projName}\n`;
                                    csv += `Período: ${dateRange.start || 'Todo'} a ${dateRange.end || 'hoy'}\n\n`;
                                    csv += 'Socio,Porcentaje,Corresponde,Ya Entregado,Pendiente\n';
                                    partnerDistribution.forEach(p => {
                                        csv += `"${p.name}",${p.percentage}%,${p.amount},${p.expensesPaid || 0},${p.remaining || 0}\n`;
                                    });
                                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `socios_${new Date().toISOString().split('T')[0]}.csv`;
                                    a.click();
                                }} disabled={partnerDistribution.length === 0} style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                                    <FiDownload /> CSV
                                </button>
                                <button className="btn btn-primary flex-1" onClick={() => {
                                    const period = dateRange.start && dateRange.end ? `${dateRange.start} a ${dateRange.end}` : 'Todo';
                                    const projName = selectedProject ? state.projects.find(p => p.id === selectedProject)?.name : '';
                                    exportPartnersPDF(partnerDistribution, formatCurrency, period, projName);
                                }} disabled={partnerDistribution.length === 0} style={{ padding: '0.5rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', borderColor: 'transparent' }}>
                                    <FiFileText /> PDF
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>


            {/* ===== REPORTE MENSUAL DE CARTERA (para Socios) ===== */}
            {filtersReadyWithProject && <div className="card mb-6">
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
                        // Mostrar en blanco hasta que se seleccione mes, año Y proyecto
                        if (!carteraProject) {
                            return (
                                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
                                    <p style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Selecciona un proyecto para ver la cartera</p>
                                    <p style={{ fontSize: 'var(--font-size-sm)' }}>Elige el mes, año y proyecto en los filtros de arriba</p>
                                </div>
                            );
                        }

                        // Build cartera data
                        const monthStart = new Date(parseInt(carteraYear), parseInt(carteraMonth) - 1, 1);
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
                        const monthLabel = new Date(parseInt(carteraYear), parseInt(carteraMonth) - 1, 1).toLocaleString('es-CO', { month: 'long', year: 'numeric' });

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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <button
                                            className="btn btn-secondary"
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
                                            <FiDownload /> CSV
                                        </button>
                                        {/* Ítem 22: Botón exportar PDF de cartera */}
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => {
                                                exportReportToPDF({
                                                    title: 'Reporte de Cartera',
                                                    subtitle: `${rows.length} clientes activos`,
                                                    columns: ['Lote', 'Proyecto', 'Cliente', 'Valor', 'Pagado', 'Saldo', 'Cuota', 'Cuotas Pend.', `Pagado ${monthLabel.split(' ')[0]}`],
                                                    data: rows.map(r => [
                                                        r.lotNumber,
                                                        r.projectName,
                                                        r.clientName,
                                                        formatCurrency(r.salePrice),
                                                        formatCurrency(r.totalPaid),
                                                        formatCurrency(r.balance),
                                                        r.installmentAmount ? formatCurrency(r.installmentAmount) : 'Contado',
                                                        String(r.pendingInstallments),
                                                        r.paidInMonth > 0 ? formatCurrency(r.paidInMonth) : '—'
                                                    ]),
                                                    stats: [
                                                        { label: 'Clientes', value: rows.length },
                                                        { label: `Recaudo ${monthLabel}`, value: formatCurrency(totalPaidInMonth) },
                                                        { label: 'Cartera Total', value: formatCurrency(totalBalance) }
                                                    ],
                                                    filename: `cartera_${carteraYear}_${carteraMonth}`,
                                                    period: monthLabel,
                                                    project: state.projects.find(p => p.id === carteraProject)?.name || ''
                                                });
                                            }}
                                        >
                                            <FiFileText /> PDF
                                        </button>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>}
            {/* ===== DESISTIMIENTOS ===== */}
            {filtersReady && <div className="card mb-6">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiAlertTriangle className="card-title-icon" style={{ color: '#f59e0b' }} />
                        Desistimientos en el Periodo
                    </h3>
                    {filteredDesistimientos.length > 0 && (
                        <Link to="/desistimientos" className="btn btn-ghost btn-sm">Ver todos</Link>
                    )}
                </div>
                <div className="card-body">
                    {filteredDesistimientos.length === 0 ? (
                        <p className="text-muted text-center">No hay desistimientos en el período seleccionado</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Proyecto</th>
                                        <th>Lote</th>
                                        <th>Cliente</th>
                                        <th style={{ textAlign: 'right' }}>Total Pagado</th>
                                        <th style={{ textAlign: 'right' }}>Monto Retenido</th>
                                        <th>Motivo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDesistimientos.map(d => (
                                        <tr key={d.id}>
                                            <td style={{ whiteSpace: 'nowrap' }}>{formatDate(d.desistimiento_date || d.created_at)}</td>
                                            <td>{d.project_name || '-'}</td>
                                            <td><span className="badge badge-info">#{d.lot_number}</span></td>
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{d.client_name}</div>
                                                {d.client_document && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{d.client_document}</div>}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(d.total_paid)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--color-success)' }}>
                                                {formatCurrency(d.amount_retained)}
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{d.reason || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: '700' }}>
                                        <td colSpan={4}>Total ({filteredDesistimientos.length})</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {formatCurrency(filteredDesistimientos.reduce((s, d) => s + parseFloat(d.total_paid || 0), 0))}
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>
                                            {formatCurrency(totalDesistimientosRetained)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>}

        </div>
        </div>
    );
}

export default Reports;
