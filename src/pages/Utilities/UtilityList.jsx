import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    FiPlus,
    FiSearch,
    FiFilter,
    FiEdit2,
    FiTrash2,
    FiDollarSign,
    FiCalendar,
    FiCheckCircle,
    FiClock,
    FiDroplet,
    FiZap,
    FiWind
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';

const SERVICE_TYPES = {
    water: { label: 'Agua', icon: FiDroplet, color: '#3b82f6' },
    energy: { label: 'Energía', icon: FiZap, color: '#f59e0b' },
    gas: { label: 'Gas', icon: FiWind, color: '#8b5cf6' },
};

const STATUS_CONFIG = {
    pending: { label: 'Pendiente', color: '#f59e0b', icon: FiClock },
    paid: { label: 'Pagado', color: '#10b981', icon: FiCheckCircle },
};

function UtilityList() {
    const { state, deleteUtilityRegistration, updateUtilityRegistration } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const filtered = useMemo(() => {
        let items = state.utilityRegistrations || [];

        if (filterType) {
            items = items.filter(u => (u.serviceType || u.service_type) === filterType);
        }
        if (filterStatus) {
            items = items.filter(u => u.status === filterStatus);
        }
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            items = items.filter(u =>
                u.client?.name?.toLowerCase().includes(search) ||
                u.notes?.toLowerCase().includes(search) ||
                u.project?.name?.toLowerCase().includes(search)
            );
        }

        return items;
    }, [state.utilityRegistrations, filterType, filterStatus, searchTerm]);

    const stats = useMemo(() => {
        const all = state.utilityRegistrations || [];
        const totalAmount = all.reduce((sum, u) => sum + parseFloat(u.amount || 0), 0);
        const totalPaid = all.filter(u => u.status === 'paid').reduce((sum, u) => sum + parseFloat(u.amount || 0), 0);
        const totalPending = all.filter(u => u.status === 'pending').reduce((sum, u) => sum + parseFloat(u.amount || 0), 0);
        return { totalAmount, totalPaid, totalPending, total: all.length };
    }, [state.utilityRegistrations]);

    const handleDelete = (id) => {
        deleteUtilityRegistration(id);
        setDeleteConfirm(null);
    };

    const handleMarkAsPaid = async (registration) => {
        await updateUtilityRegistration({
            ...registration,
            status: 'paid',
            paidDate: new Date().toISOString().split('T')[0],
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('es-CO', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <h1>Matrículas de Servicios</h1>
                    <p>Registro de cobros de agua, energía y gas</p>
                </div>
                <Link to="/utilities/new" className="btn btn-primary">
                    <FiPlus /> Nueva Matrícula
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.5rem' }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                        <FiDollarSign />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{formatCurrency(stats.totalAmount)}</span>
                        <span className="stat-label">Total Cobrado</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        <FiCheckCircle />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{formatCurrency(stats.totalPaid)}</span>
                        <span className="stat-label">Pagado</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                        <FiClock />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{formatCurrency(stats.totalPending)}</span>
                        <span className="stat-label">Pendiente</span>
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-body">
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                            <div style={{ position: 'relative' }}>
                                <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Buscar por cliente o proyecto..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ paddingLeft: '40px' }}
                                />
                            </div>
                        </div>
                        <button
                            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <FiFilter /> Filtros
                        </button>
                    </div>

                    {showFilters && (
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                                <label className="form-label">Tipo de Servicio</label>
                                <select
                                    className="form-control"
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                >
                                    <option value="">Todos los servicios</option>
                                    {Object.entries(SERVICE_TYPES).map(([key, svc]) => (
                                        <option key={key} value={key}>{svc.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                                <label className="form-label">Estado</label>
                                <select
                                    className="form-control"
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                >
                                    <option value="">Todos los estados</option>
                                    <option value="pending">Pendiente</option>
                                    <option value="paid">Pagado</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {filtered.length === 0 ? (
                        <div className="empty-state">
                            <FiZap className="empty-state-icon" />
                            <h3>No hay matrículas registradas</h3>
                            <p>Registra el cobro de servicios públicos para los clientes</p>
                            <Link to="/utilities/new" className="btn btn-primary">
                                <FiPlus /> Nueva Matrícula
                            </Link>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Lote</th>
                                        <th>Servicio</th>
                                        <th>Fecha Cobro</th>
                                        <th style={{ textAlign: 'right' }}>Monto</th>
                                        <th style={{ textAlign: 'center' }}>Estado</th>
                                        <th style={{ textAlign: 'center' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(reg => {
                                        const serviceType = SERVICE_TYPES[reg.serviceType || reg.service_type] || SERVICE_TYPES.water;
                                        const statusConfig = STATUS_CONFIG[reg.status] || STATUS_CONFIG.pending;
                                        const ServiceIcon = serviceType.icon;
                                        const StatusIcon = statusConfig.icon;

                                        return (
                                            <tr key={reg.id}>
                                                <td>
                                                    <div style={{ fontWeight: 500 }}>{reg.client?.name || 'Sin cliente'}</div>
                                                    {reg.project?.name && (
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                            {reg.project.name}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <span style={{ fontWeight: 500 }}>
                                                        Lote #{reg.lot?.number || '—'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span
                                                        className="badge"
                                                        style={{
                                                            background: `${serviceType.color}20`,
                                                            color: serviceType.color,
                                                            border: `1px solid ${serviceType.color}40`,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <ServiceIcon style={{ marginRight: '4px' }} />
                                                        {serviceType.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                                        <FiCalendar />
                                                        {formatDate(reg.chargeDate || reg.charge_date)}
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                                    {formatCurrency(reg.amount)}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span
                                                        className="badge"
                                                        style={{
                                                            background: `${statusConfig.color}20`,
                                                            color: statusConfig.color,
                                                            border: `1px solid ${statusConfig.color}40`,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <StatusIcon />
                                                        {statusConfig.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                        {reg.status === 'pending' && (
                                                            <button
                                                                className="btn btn-sm btn-primary"
                                                                onClick={() => handleMarkAsPaid(reg)}
                                                                title="Marcar como pagado"
                                                            >
                                                                <FiCheckCircle />
                                                            </button>
                                                        )}
                                                        <Link
                                                            to={`/utilities/${reg.id}/edit`}
                                                            className="btn btn-sm btn-secondary"
                                                            title="Editar"
                                                        >
                                                            <FiEdit2 />
                                                        </Link>
                                                        <button
                                                            className="btn btn-sm btn-danger"
                                                            onClick={() => setDeleteConfirm(reg.id)}
                                                            title="Eliminar"
                                                        >
                                                            <FiTrash2 />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'right', fontWeight: 600 }}>
                                            Total:
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.1rem' }}>
                                            {formatCurrency(filtered.reduce((sum, u) => sum + parseFloat(u.amount || 0), 0))}
                                        </td>
                                        <td colSpan="2"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Confirmar Eliminación</h3>
                        </div>
                        <div className="modal-body">
                            <p>¿Estás seguro de que deseas eliminar esta matrícula? Esta acción no se puede deshacer.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                                Cancelar
                            </button>
                            <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                                <FiTrash2 /> Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UtilityList;
