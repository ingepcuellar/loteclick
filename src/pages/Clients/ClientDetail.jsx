import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    FiEdit2,
    FiTrash2,
    FiArrowLeft,
    FiPhone,
    FiMail,
    FiMapPin,
    FiShoppingCart,
    FiDollarSign,
    FiCalendar
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

function ClientDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getClientById, deleteClient, getSalesByClient, state, getPaymentsBySale } = useApp();
    const { isAdmin } = useAuth();

    const client = getClientById(id);
    const clientSales = getSalesByClient(id);

    if (!client) {
        return (
            <div className="card">
                <div className="empty-state">
                    <h3>Cliente no encontrado</h3>
                    <p>El cliente que buscas no existe o fue eliminado</p>
                    <Link to="/clients" className="btn btn-primary">
                        <FiArrowLeft /> Volver a Clientes
                    </Link>
                </div>
            </div>
        );
    }

    const handleDelete = () => {
        if (clientSales.length > 0) {
            alert(`No se puede eliminar el cliente porque tiene ${clientSales.length} venta(s) asociada(s).`);
            return;
        }
        if (window.confirm(`¿Estás seguro de eliminar el cliente "${client.name || client.fullName}"?`)) {
            deleteClient(id);
            navigate('/clients');
        }
    };

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
            month: 'long',
            day: 'numeric',
        });
    };

    // Calculate totals
    const totalPurchases = clientSales.reduce((sum, s) => sum + parseFloat(s.totalPrice || 0), 0);
    const totalPaid = clientSales.reduce((sum, sale) => {
        const payments = getPaymentsBySale(sale.id);
        return sum + payments.reduce((pSum, p) => pSum + parseFloat(p.amount || 0), 0);
    }, 0);
    const totalPending = totalPurchases - totalPaid;

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <Link to="/clients" className="btn btn-ghost btn-sm mb-2">
                        <FiArrowLeft /> Volver
                    </Link>
                    <div className="flex gap-4" style={{ alignItems: 'center' }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-accent-500))',
                            borderRadius: 'var(--radius-xl)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '700',
                            fontSize: 'var(--font-size-2xl)'
                        }}>
                            {(client.name || client.fullName)?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                            <h1 style={{ marginBottom: 'var(--spacing-1)' }}>{client.name || client.fullName}</h1>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>{client.document}</p>
                        </div>
                    </div>
                </div>
                <div className="page-header-actions">
                    <Link to={`/clients/${id}/edit`} className="btn btn-secondary">
                        <FiEdit2 /> Editar
                    </Link>
                    {isAdmin() && (
                        <button className="btn btn-danger" onClick={handleDelete}>
                            <FiTrash2 /> Eliminar
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-3 mb-6">
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <FiShoppingCart />
                        </div>
                        <div className="stat-content">
                            <h3>{clientSales.length}</h3>
                            <p>Compras</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon accent">
                            <FiDollarSign />
                        </div>
                        <div className="stat-content">
                            <h3>{formatCurrency(totalPaid)}</h3>
                            <p>Pagado</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="stat-card">
                        <div className="stat-icon warning">
                            <FiDollarSign />
                        </div>
                        <div className="stat-content">
                            <h3>{formatCurrency(totalPending)}</h3>
                            <p>Pendiente</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-2">
                {/* Contact Info */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Información de Contacto</h3>
                    </div>
                    <div className="card-body">
                        <div className="flex flex-col gap-4">
                            {client.phone && (
                                <div className="flex gap-3" style={{ alignItems: 'center' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-lg)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--color-primary-400)'
                                    }}>
                                        <FiPhone />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Teléfono</div>
                                        <div>{client.phone}</div>
                                    </div>
                                </div>
                            )}

                            {client.email && (
                                <div className="flex gap-3" style={{ alignItems: 'center' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-lg)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--color-primary-400)'
                                    }}>
                                        <FiMail />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Email</div>
                                        <div>{client.email}</div>
                                    </div>
                                </div>
                            )}

                            {client.address && (
                                <div className="flex gap-3" style={{ alignItems: 'center' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-lg)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--color-primary-400)'
                                    }}>
                                        <FiMapPin />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Dirección</div>
                                        <div>{client.address}</div>
                                    </div>
                                </div>
                            )}

                            {client.notes && (
                                <div style={{
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 'var(--spacing-4)',
                                    marginTop: 'var(--spacing-2)'
                                }}>
                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--spacing-2)' }}>
                                        Notas
                                    </div>
                                    <div>{client.notes}</div>
                                </div>
                            )}

                            <div style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-muted)',
                                marginTop: 'var(--spacing-4)'
                            }}>
                                <FiCalendar size={12} style={{ marginRight: '4px' }} />
                                Cliente desde: {formatDate(client.createdAt)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Purchases */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiShoppingCart className="card-title-icon" />
                            Compras
                        </h3>
                    </div>
                    <div className="card-body">
                        {clientSales.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--spacing-6)' }}>
                                <p>Este cliente no tiene compras registradas</p>
                                <Link to="/sales/new" className="btn btn-primary btn-sm">
                                    Registrar Venta
                                </Link>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {clientSales.map(sale => {
                                    const project = state.projects.find(p => p.id === sale.projectId);
                                    const payments = getPaymentsBySale(sale.id);
                                    const paid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                                    const isPaid = paid >= parseFloat(sale.totalPrice || 0);

                                    return (
                                        <Link
                                            key={sale.id}
                                            to={`/sales/${sale.id}`}
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-lg)',
                                                padding: 'var(--spacing-4)',
                                                textDecoration: 'none',
                                                color: 'inherit'
                                            }}
                                        >
                                            <div className="flex-between mb-2">
                                                <div style={{ fontWeight: '500' }}>
                                                    {project?.name || 'Proyecto'} - Lote {sale.lotNumber}
                                                </div>
                                                <span className={`badge ${isPaid ? 'badge-success' : 'badge-warning'}`}>
                                                    {isPaid ? 'Pagado' : 'Pendiente'}
                                                </span>
                                            </div>
                                            <div className="flex-between">
                                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                                    {formatDate(sale.createdAt)}
                                                </span>
                                                <span style={{ fontWeight: '600', color: 'var(--color-primary-400)' }}>
                                                    {formatCurrency(sale.totalPrice)}
                                                </span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ClientDetail;
