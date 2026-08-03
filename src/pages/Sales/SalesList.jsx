import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    FiPlus,
    FiShoppingCart,
    FiSearch,
    FiEye,
    FiFileText,
    FiFilter,
    FiCalendar
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../lib/formatters';

function SalesList() {
    const { state, getPaymentsBySale } = useApp();
    const { isPartner, isAdmin, currentUser } = useAuth();
    // Filtrar proyectos del socio
    const partnerProjectIds = currentUser?.associated_projects || currentUser?.associatedProjects || [];
    const isRestrictedPartner = isPartner() && !isAdmin();
    const visibleProjectIds = isRestrictedPartner && partnerProjectIds.length > 0
        ? partnerProjectIds.map(String)
        : null;
    const visibleProjects = isRestrictedPartner
        ? state.projects.filter(p => (visibleProjectIds || []).includes(String(p.id)))
        : state.projects;
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterManzana, setFilterManzana] = useState('');
    const [filterEtapa, setFilterEtapa] = useState('');

    const getSaleStatus = (sale) => {
        // Si la venta fue desistida, priorizamos ese estado siempre
        if ((sale.status || 'active') === 'desistida') {
            return { label: 'Desistida', class: 'badge-warning-amber' };
        }
        const payments = getPaymentsBySale(sale.id);
        const paid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const total = parseFloat(sale.totalPrice || 0);

        if (paid >= total) return { label: 'Pagado', class: 'badge-success' };
        if (paid > 0) return { label: 'Parcial', class: 'badge-warning' };
        return { label: 'Pendiente', class: 'badge-error' };
    };

    // Obtener manzanas y etapas únicas para los filtros
    const uniqueManzanas = [...new Set(
        state.sales.map(s => s.lotManzana || s.lot_manzana).filter(Boolean)
    )].sort();
    const uniqueEtapas = [...new Set(
        state.sales.map(s => s.lotEtapaName || s.lot_etapa_name).filter(Boolean)
    )].sort();

    const filteredSales = state.sales.filter(sale => {
        const client = state.clients.find(c => c.id === sale.clientId);
        const project = state.projects.find(p => p.id === sale.projectId);
        const manzana = sale.lotManzana || sale.lot_manzana || '';
        const etapa = sale.lotEtapaName || sale.lot_etapa_name || '';

        // Filtro por rol: socios solo ven ventas de sus proyectos
        if (visibleProjectIds && !visibleProjectIds.includes(String(sale.projectId || sale.project_id || ''))) return false;

        const matchesSearch = !searchTerm ||
            (client?.name || client?.fullName)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client?.document || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sale.lotNumber?.toString().includes(searchTerm) ||
            manzana.toLowerCase().includes(searchTerm.toLowerCase()) ||
            etapa.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesProject = !filterProject || sale.projectId === filterProject;
        const matchesManzana = !filterManzana || manzana === filterManzana;
        const matchesEtapa = !filterEtapa || etapa === filterEtapa;

        const status = getSaleStatus(sale);
        const matchesStatus = !filterStatus ||
            (filterStatus === 'paid' && status.label === 'Pagado') ||
            (filterStatus === 'partial' && status.label === 'Parcial') ||
            (filterStatus === 'pending' && status.label === 'Pendiente') ||
            (filterStatus === 'desistida' && status.label === 'Desistida');

        return matchesSearch && matchesProject && matchesManzana && matchesEtapa && matchesStatus;
    });

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <h1>Ventas</h1>
                    <p>Gestiona las ventas de lotes</p>
                </div>
                <div className="page-header-actions">
                    <Link to="/sales/new" className="btn btn-primary">
                        <FiPlus />
                        Nueva Venta
                    </Link>
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
                            placeholder="Buscar por cliente, cédula, proyecto, lote, manzana o etapa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: 'var(--spacing-10)' }}
                        />
                    </div>

                    <select
                        className="form-select"
                        value={filterProject}
                        onChange={(e) => { setFilterProject(e.target.value); setFilterManzana(''); setFilterEtapa(''); }}
                        style={{ width: '180px' }}
                    >
                        <option value="">Todos los proyectos</option>
                        {visibleProjects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

                    {uniqueEtapas.length > 0 && (
                        <select
                            className="form-select"
                            value={filterEtapa}
                            onChange={(e) => setFilterEtapa(e.target.value)}
                            style={{ width: '150px' }}
                        >
                            <option value="">Todas las etapas</option>
                            {uniqueEtapas.map(e => (
                                <option key={e} value={e}>{e}</option>
                            ))}
                        </select>
                    )}

                    {uniqueManzanas.length > 0 && (
                        <select
                            className="form-select"
                            value={filterManzana}
                            onChange={(e) => setFilterManzana(e.target.value)}
                            style={{ width: '150px' }}
                        >
                            <option value="">Todas las manzanas</option>
                            {uniqueManzanas.map(m => (
                                <option key={m} value={m}>Manzana {m}</option>
                            ))}
                        </select>
                    )}

                    <select
                        className="form-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={{ width: '140px' }}
                    >
                        <option value="">Todos</option>
                        <option value="paid">Pagados</option>
                        <option value="partial">Parciales</option>
                        <option value="pending">Pendientes</option>
                        <option value="desistida">Desistidas</option>
                    </select>
                </div>
            </div>

            {/* Sales Table */}
            {state.sales.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <FiShoppingCart />
                        </div>
                        <h3>No hay ventas</h3>
                        <p>Registra tu primera venta para comenzar</p>
                        <Link to="/sales/new" className="btn btn-primary">
                            <FiPlus />
                            Nueva Venta
                        </Link>
                    </div>
                </div>
            ) : filteredSales.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <FiFilter />
                        </div>
                        <h3>Sin resultados</h3>
                        <p>No se encontraron ventas con los filtros aplicados</p>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Proyecto / Lote</th>
                                    <th>Cliente</th>
                                    <th>Precio</th>
                                    <th>Pagado</th>
                                    <th>Fecha</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.map(sale => {
                                    const client = state.clients.find(c => c.id === sale.clientId);
                                    const project = state.projects.find(p => p.id === sale.projectId);
                                    const payments = getPaymentsBySale(sale.id);
                                    const paid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                                    const status = getSaleStatus(sale);

                                    return (
                                        <tr key={sale.id}>
                                            <td>
                                                <div>
                                                    <div style={{ fontWeight: '500' }}>{project?.name || '-'}</div>
                                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                                        Lote {sale.lotNumber}
                                                        {(sale.lotManzana || sale.lot_manzana) && ` · Mzn ${sale.lotManzana || sale.lot_manzana}`}
                                                        {(sale.lotEtapaName || sale.lot_etapa_name) && ` · ${sale.lotEtapaName || sale.lot_etapa_name}`}
                                                    </div>
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
                                            <td style={{ fontWeight: '500' }}>{formatCurrency(sale.totalPrice)}</td>
                                            <td style={{ color: 'var(--color-success)' }}>{formatCurrency(paid)}</td>
                                            <td>
                                                <div className="flex gap-1" style={{ alignItems: 'center', color: 'var(--text-muted)' }}>
                                                    <FiCalendar size={12} />
                                                    {formatDate(sale.saleDate || sale.sale_date || sale.created_at)}
                                                </div>
                                            </td>
                                            <td>
                                                {status.label === 'Desistida' ? (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '3px 8px',
                                                        borderRadius: 'var(--radius-full)',
                                                        fontSize: 'var(--font-size-xs)',
                                                        fontWeight: '600',
                                                        background: 'rgba(245,158,11,0.15)',
                                                        color: '#b45309',
                                                        border: '1px solid rgba(245,158,11,0.35)',
                                                    }}>
                                                        ⚠️ Desistida
                                                    </span>
                                                ) : (
                                                    <span className={`badge ${status.class}`}>
                                                        {status.label}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <Link to={`/sales/${sale.id}`} className="btn btn-ghost btn-sm">
                                                        <FiEye />
                                                    </Link>
                                                    <Link to={`/sales/${sale.id}`} className="btn btn-ghost btn-sm" title="Ver contrato">
                                                        <FiFileText />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="mobile-card-list">
                        {filteredSales.map(sale => {
                            const client = state.clients.find(c => c.id === sale.clientId);
                            const project = state.projects.find(p => p.id === sale.projectId);
                            const payments = getPaymentsBySale(sale.id);
                            const paid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                            const status = getSaleStatus(sale);

                            return (
                                <Link to={`/sales/${sale.id}`} key={sale.id} className="mobile-card-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div className="mobile-card-header">
                                        <div className="mobile-card-main">
                                            <div className="mobile-card-avatar">
                                                {(client?.name || client?.fullName)?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <div className="mobile-card-title">{client?.name || client?.fullName || '-'}</div>
                                                <div className="mobile-card-subtitle">
                                                    {project?.name || '-'} · Lote {sale.lotNumber}
                                                    {(sale.lotManzana || sale.lot_manzana) && ` · Mzn ${sale.lotManzana || sale.lot_manzana}`}
                                                </div>
                                            </div>
                                        </div>
                                        {status.label === 'Desistida' ? (
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                padding: '3px 8px', borderRadius: 'var(--radius-full)',
                                                fontSize: 'var(--font-size-xs)', fontWeight: '600',
                                                background: 'rgba(245,158,11,0.15)', color: '#b45309',
                                                border: '1px solid rgba(245,158,11,0.35)',
                                            }}>
                                                ⚠️ Desistida
                                            </span>
                                        ) : (
                                            <span className={`badge ${status.class}`}>{status.label}</span>
                                        )}
                                    </div>
                                    <div className="mobile-card-body">
                                        <div className="mobile-card-row">
                                            <span className="mobile-card-label">Precio</span>
                                            <span className="mobile-card-value">{formatCurrency(sale.totalPrice)}</span>
                                        </div>
                                        <div className="mobile-card-row">
                                            <span className="mobile-card-label">Pagado</span>
                                            <span className="mobile-card-value" style={{ color: 'var(--color-success)' }}>{formatCurrency(paid)}</span>
                                        </div>
                                        <div className="mobile-card-row">
                                            <span className="mobile-card-label">Fecha</span>
                                            <span className="mobile-card-value">{formatDate(sale.saleDate || sale.sale_date || sale.created_at)}</span>
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

export default SalesList;
