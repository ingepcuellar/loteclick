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

function SalesList() {
    const { state, getPaymentsBySale } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getSaleStatus = (sale) => {
        const payments = getPaymentsBySale(sale.id);
        const paid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const total = parseFloat(sale.totalPrice || 0);

        if (paid >= total) return { label: 'Pagado', class: 'badge-success' };
        if (paid > 0) return { label: 'Parcial', class: 'badge-warning' };
        return { label: 'Pendiente', class: 'badge-error' };
    };

    const filteredSales = state.sales.filter(sale => {
        const client = state.clients.find(c => c.id === sale.clientId);
        const project = state.projects.find(p => p.id === sale.projectId);

        const matchesSearch =
            (client?.name || client?.fullName)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client?.document || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sale.lotNumber?.toString().includes(searchTerm);

        const matchesProject = !filterProject || sale.projectId === filterProject;

        const status = getSaleStatus(sale);
        const matchesStatus = !filterStatus ||
            (filterStatus === 'paid' && status.label === 'Pagado') ||
            (filterStatus === 'partial' && status.label === 'Parcial') ||
            (filterStatus === 'pending' && status.label === 'Pendiente');

        return matchesSearch && matchesProject && matchesStatus;
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
                            placeholder="Buscar por cliente, cédula, proyecto o lote..."
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

                    <select
                        className="form-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={{ width: '150px' }}
                    >
                        <option value="">Todos</option>
                        <option value="paid">Pagados</option>
                        <option value="partial">Parciales</option>
                        <option value="pending">Pendientes</option>
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
                                                <span className={`badge ${status.class}`}>
                                                    {status.label}
                                                </span>
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
                </div>
            )}
        </div>
    );
}

export default SalesList;
