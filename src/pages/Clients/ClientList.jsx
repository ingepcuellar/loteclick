import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiUsers, FiSearch, FiEdit2, FiTrash2, FiEye, FiPhone, FiMail } from 'react-icons/fi';
import { useApp } from '../../context/AppContext';

function ClientList() {
    const { state, deleteClient, getSalesByClient } = useApp();
    const [searchTerm, setSearchTerm] = useState('');

    const handleDelete = (clientId, clientName) => {
        const clientSales = getSalesByClient(clientId);
        if (clientSales.length > 0) {
            alert(`No se puede eliminar el cliente "${clientName}" porque tiene ${clientSales.length} venta(s) asociada(s).`);
            return;
        }
        if (window.confirm(`¿Estás seguro de eliminar el cliente "${clientName}"?`)) {
            deleteClient(clientId);
        }
    };

    const filteredClients = state.clients.filter(client => {
        const clientName = client.name || client.fullName || '';
        return clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.document?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.email?.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <h1>Clientes</h1>
                    <p>Gestiona la información de tus clientes</p>
                </div>
                <div className="page-header-actions">
                    <Link to="/clients/new" className="btn btn-primary">
                        <FiPlus />
                        Nuevo Cliente
                    </Link>
                </div>
            </div>

            {/* Search Bar */}
            <div className="card mb-6">
                <div className="flex gap-4" style={{ alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
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
                            placeholder="Buscar por nombre, documento o email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: 'var(--spacing-10)' }}
                        />
                    </div>
                </div>
            </div>

            {/* Clients Table */}
            {state.clients.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <FiUsers />
                        </div>
                        <h3>No hay clientes</h3>
                        <p>Registra tu primer cliente para comenzar</p>
                        <Link to="/clients/new" className="btn btn-primary">
                            <FiPlus />
                            Nuevo Cliente
                        </Link>
                    </div>
                </div>
            ) : filteredClients.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <FiSearch />
                        </div>
                        <h3>Sin resultados</h3>
                        <p>No se encontraron clientes que coincidan con "{searchTerm}"</p>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th>Documento</th>
                                    <th>Contacto</th>
                                    <th>Compras</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClients.map(client => {
                                    const clientSales = getSalesByClient(client.id);

                                    return (
                                        <tr key={client.id}>
                                            <td>
                                                <div className="flex gap-3" style={{ alignItems: 'center' }}>
                                                    <div style={{
                                                        width: '40px',
                                                        height: '40px',
                                                        background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-accent-500))',
                                                        borderRadius: 'var(--radius-lg)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        fontWeight: '600'
                                                    }}>
                                                        {(client.name || client.fullName)?.charAt(0).toUpperCase() || '?'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '500' }}>{client.name || client.fullName}</div>
                                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                                            {client.address || 'Sin dirección'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{client.document || '-'}</td>
                                            <td>
                                                <div className="flex flex-col gap-1">
                                                    {client.phone && (
                                                        <div className="flex gap-2" style={{ alignItems: 'center', fontSize: 'var(--font-size-sm)' }}>
                                                            <FiPhone size={12} />
                                                            {client.phone}
                                                        </div>
                                                    )}
                                                    {client.email && (
                                                        <div className="flex gap-2" style={{ alignItems: 'center', fontSize: 'var(--font-size-sm)' }}>
                                                            <FiMail size={12} />
                                                            {client.email}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${clientSales.length > 0 ? 'badge-success' : 'badge-neutral'}`}>
                                                    {clientSales.length} compra{clientSales.length !== 1 ? 's' : ''}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <Link to={`/clients/${client.id}`} className="btn btn-ghost btn-sm">
                                                        <FiEye />
                                                    </Link>
                                                    <Link to={`/clients/${client.id}/edit`} className="btn btn-ghost btn-sm">
                                                        <FiEdit2 />
                                                    </Link>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handleDelete(client.id, client.name || client.fullName)}
                                                        style={{ color: 'var(--color-error)' }}
                                                    >
                                                        <FiTrash2 />
                                                    </button>
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
                        {filteredClients.map(client => {
                            const clientSales = getSalesByClient(client.id);
                            return (
                                <Link to={`/clients/${client.id}`} key={client.id} className="mobile-card-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div className="mobile-card-header">
                                        <div className="mobile-card-main">
                                            <div className="mobile-card-avatar">
                                                {(client.name || client.fullName)?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <div className="mobile-card-title">{client.name || client.fullName}</div>
                                                <div className="mobile-card-subtitle">{client.document || 'Sin documento'}</div>
                                            </div>
                                        </div>
                                        <span className={`badge ${clientSales.length > 0 ? 'badge-success' : 'badge-neutral'}`}>
                                            {clientSales.length} compra{clientSales.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="mobile-card-body">
                                        {client.phone && (
                                            <div className="mobile-card-row">
                                                <span className="mobile-card-label"><FiPhone size={12} style={{ marginRight: 4 }} />Teléfono</span>
                                                <span className="mobile-card-value">{client.phone}</span>
                                            </div>
                                        )}
                                        {client.email && (
                                            <div className="mobile-card-row">
                                                <span className="mobile-card-label"><FiMail size={12} style={{ marginRight: 4 }} />Email</span>
                                                <span className="mobile-card-value">{client.email}</span>
                                            </div>
                                        )}
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

export default ClientList;
