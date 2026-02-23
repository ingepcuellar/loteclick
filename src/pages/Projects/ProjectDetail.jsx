import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    FiEdit2,
    FiTrash2,
    FiMapPin,
    FiUsers,
    FiGrid,
    FiDollarSign,
    FiArrowLeft,
    FiShoppingCart
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/formatters';
import ConfirmModal from '../../components/ui/ConfirmModal';

function ProjectDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getProjectById, deleteProject, getSalesByProject, state } = useApp();
    const { isSeller, isAdmin } = useAuth();

    const project = getProjectById(id);
    const sales = getSalesByProject(id);

    if (!project) {
        return (
            <div className="card">
                <div className="empty-state">
                    <h3>Proyecto no encontrado</h3>
                    <p>El proyecto que buscas no existe o fue eliminado</p>
                    <Link to="/projects" className="btn btn-primary">
                        <FiArrowLeft /> Volver a Proyectos
                    </Link>
                </div>
            </div>
        );
    }

    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    const handleDelete = () => {
        setShowConfirmDelete(true);
    };

    const executeDelete = () => {
        deleteProject(id);
        navigate('/projects');
    };



    // Stats
    const totalLots = project.lots?.length || 0;
    const soldLots = project.lots?.filter(l => l.status === 'sold').length || 0;
    const pendingLots = project.lots?.filter(l => l.status === 'pending_initial').length || 0;
    const availableLots = totalLots - soldLots - pendingLots;
    const totalValue = project.lots?.reduce((sum, l) => sum + parseFloat(l.price || 0), 0) || 0;
    const soldValue = sales.reduce((sum, s) => sum + parseFloat(s.totalPrice || 0), 0);

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <Link to="/projects" className="btn btn-ghost btn-sm mb-2">
                        <FiArrowLeft /> Volver
                    </Link>
                    <h1>{project.name}</h1>
                    <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                        <FiMapPin />
                        {project.location}
                    </p>
                </div>
                <div className="page-header-actions">
                    {!isSeller() && (
                        <>
                            <Link to={`/projects/${id}/edit`} className="btn btn-secondary">
                                <FiEdit2 /> Editar
                            </Link>
                            {isAdmin() && (
                                <button className="btn btn-danger" onClick={handleDelete}>
                                    <FiTrash2 /> Eliminar
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-4 mb-6">
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <FiGrid />
                        </div>
                        <div className="stat-content">
                            <h3>{totalLots}</h3>
                            <p>Total Lotes</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon warning">
                            <FiGrid />
                        </div>
                        <div className="stat-content">
                            <h3>{availableLots}</h3>
                            <p>Disponibles</p>
                        </div>
                    </div>
                </div>
                {!isSeller() && (
                    <>
                        <div className="card">
                            <div className="stat-card">
                                <div className="stat-icon accent">
                                    <FiShoppingCart />
                                </div>
                                <div className="stat-content">
                                    <h3>{soldLots}</h3>
                                    <p>Vendidos</p>
                                </div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                                    <FiGrid />
                                </div>
                                <div className="stat-content">
                                    <h3>{pendingLots}</h3>
                                    <p>Pend. Cuota Inicial</p>
                                </div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card">
                                <div className="stat-icon info">
                                    <FiDollarSign />
                                </div>
                                <div className="stat-content">
                                    <h3>{formatCurrency(soldValue)}</h3>
                                    <p>Vendido</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className={isSeller() ? '' : 'grid grid-2'}>
                {/* Partners - hidden for sellers */}
                {!isSeller() && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">
                                <FiUsers className="card-title-icon" />
                                Socios ({project.partners?.length || 0})
                            </h3>
                        </div>
                        <div className="card-body">
                            {project.partners?.length > 0 ? (
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Nombre</th>
                                                <th>Participación</th>
                                                <th>Documento</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {project.partners.map(partner => (
                                                <tr key={partner.id}>
                                                    <td>{partner.name}</td>
                                                    <td>
                                                        <span className="badge badge-success">{partner.percentage}%</span>
                                                    </td>
                                                    <td>{partner.document || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-muted">No hay socios registrados</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Lots Grid */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiGrid className="card-title-icon" />
                            Lotes
                        </h3>
                    </div>
                    <div className="card-body">
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                            gap: 'var(--spacing-2)'
                        }}>
                            {project.lots?.map(lot => {
                                const sale = (lot.status === 'sold' || lot.status === 'pending_initial') ? sales.find(s => s.lotId === lot.id) : null;
                                const client = sale ? state.clients.find(c => c.id === sale.clientId) : null;

                                const getLotStyle = () => {
                                    if (lot.status === 'sold') return {
                                        bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.1))',
                                        border: 'var(--color-success)',
                                        textColor: 'var(--color-success)',
                                        label: 'Vendido'
                                    };
                                    if (lot.status === 'pending_initial') return {
                                        bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(245, 158, 11, 0.1))',
                                        border: '#f59e0b',
                                        textColor: '#f59e0b',
                                        label: 'Pend. Cuota'
                                    };
                                    return {
                                        bg: 'var(--bg-tertiary)',
                                        border: 'var(--border-color)',
                                        textColor: 'var(--text-muted)',
                                        label: `${lot.area || '?'} m²`
                                    };
                                };
                                const style = getLotStyle();

                                return (
                                    <div
                                        key={lot.id}
                                        title={lot.status === 'sold' ? `Vendido a: ${client?.name || client?.fullName || 'Cliente'}` : lot.status === 'pending_initial' ? `Pendiente cuota inicial: ${client?.name || client?.fullName || 'Cliente'}` : `Disponible - ${formatCurrency(lot.price)} - Click para vender`}
                                        onClick={() => {
                                            if (lot.status === 'available' || !lot.status) {
                                                navigate(`/sales/new?projectId=${project.id}&lotId=${lot.id}`);
                                            } else if (sale) {
                                                navigate(`/sales/${sale.id}`);
                                            }
                                        }}
                                        style={{
                                            padding: 'var(--spacing-3)',
                                            background: style.bg,
                                            border: `2px solid ${style.border}`,
                                            borderRadius: 'var(--radius-lg)',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all var(--transition-base)'
                                        }}
                                    >
                                        <div style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)' }}>
                                            {lot.number}
                                        </div>
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            color: style.textColor
                                        }}>
                                            {style.label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="flex gap-4 mt-4" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                            <div className="flex gap-2" style={{ alignItems: 'center' }}>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    background: 'var(--bg-tertiary)',
                                    border: '2px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)'
                                }} />
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Disponible</span>
                            </div>
                            <div className="flex gap-2" style={{ alignItems: 'center' }}>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    background: 'rgba(245, 158, 11, 0.3)',
                                    border: '2px solid #f59e0b',
                                    borderRadius: 'var(--radius-sm)'
                                }} />
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Pend. Cuota Inicial</span>
                            </div>
                            <div className="flex gap-2" style={{ alignItems: 'center' }}>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    background: 'rgba(16, 185, 129, 0.3)',
                                    border: '2px solid var(--color-success)',
                                    borderRadius: 'var(--radius-sm)'
                                }} />
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Vendido</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Sales */}
            {sales.length > 0 && (
                <div className="card mt-6">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiShoppingCart className="card-title-icon" />
                            Ventas del Proyecto
                        </h3>
                        <Link to="/sales" className="btn btn-ghost btn-sm">Ver todas</Link>
                    </div>
                    <div className="card-body">
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Lote</th>
                                        <th>Cliente</th>
                                        <th>Precio</th>
                                        <th>Fecha</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sales.map(sale => {
                                        const client = state.clients.find(c => c.id === sale.clientId);
                                        return (
                                            <tr key={sale.id}>
                                                <td>Lote {sale.lotNumber}</td>
                                                <td>{client?.name || client?.fullName || '-'}</td>
                                                <td>{formatCurrency(sale.totalPrice)}</td>
                                                <td>{new Date(sale.createdAt).toLocaleDateString('es-CO')}</td>
                                                <td>
                                                    <Link to={`/sales/${sale.id}`} className="btn btn-ghost btn-sm">
                                                        Ver detalle
                                                    </Link>
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

            <ConfirmModal
                isOpen={showConfirmDelete}
                title={`¿Eliminar proyecto "${project.name}"?`}
                message="Esta acción no se puede deshacer."
                confirmText="Eliminar"
                variant="danger"
                onConfirm={executeDelete}
                onCancel={() => setShowConfirmDelete(false)}
            />
        </div>
    );
}

export default ProjectDetail;
