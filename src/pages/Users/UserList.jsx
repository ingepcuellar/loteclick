import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    FiPlus,
    FiSearch,
    FiEdit2,
    FiTrash2,
    FiUser,
    FiMail,
    FiShield,
    FiCheck,
    FiX,
    FiFilter
} from 'react-icons/fi';
import { useAuth, ROLE_LABELS } from '../../context/AuthContext';

const ROLE_COLORS = {
    admin: { bg: '#3b82f620', color: '#3b82f6', border: '#3b82f640' },
    seller: { bg: '#10b98120', color: '#10b981', border: '#10b98140' },
    partner: { bg: '#8b5cf620', color: '#8b5cf6', border: '#8b5cf640' }
};

function UserList() {
    const { users, deleteUser, isAdmin } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [error, setError] = useState('');

    // Filter users
    const filteredUsers = useMemo(() => {
        let result = users;

        if (filterRole) {
            result = result.filter(u => u.role === filterRole);
        }

        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            result = result.filter(u =>
                u.name?.toLowerCase().includes(search) ||
                u.email?.toLowerCase().includes(search)
            );
        }

        return result;
    }, [users, filterRole, searchTerm]);

    const handleDelete = (id) => {
        const result = deleteUser(id);
        if (!result.success) {
            setError(result.error);
            setTimeout(() => setError(''), 3000);
        }
        setDeleteConfirm(null);
    };

    if (!isAdmin()) {
        return (
            <div className="page-container">
                <div className="empty-state">
                    <FiShield className="empty-state-icon" />
                    <h3>Acceso Denegado</h3>
                    <p>Solo los administradores pueden gestionar usuarios</p>
                    <Link to="/" className="btn btn-primary">
                        Volver al Inicio
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <h1>Usuarios</h1>
                    <p>Gestiona los usuarios y sus permisos</p>
                </div>
                <Link to="/users/new" className="btn btn-primary">
                    <FiPlus /> Nuevo Usuario
                </Link>
            </div>

            {/* Error Message */}
            {error && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

            {/* Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: '1.5rem' }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                        <FiShield />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{users.filter(u => u.role === 'admin').length}</span>
                        <span className="stat-label">Administradores</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        <FiUser />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{users.filter(u => u.role === 'seller').length}</span>
                        <span className="stat-label">Vendedores</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
                        <FiUser />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{users.filter(u => u.role === 'partner').length}</span>
                        <span className="stat-label">Socios</span>
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
                                    placeholder="Buscar usuarios..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ paddingLeft: '40px' }}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
                            <select
                                className="form-control"
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                            >
                                <option value="">Todos los roles</option>
                                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {filteredUsers.length === 0 ? (
                        <div className="empty-state">
                            <FiUser className="empty-state-icon" />
                            <h3>No hay usuarios</h3>
                            <p>Crea el primer usuario del sistema</p>
                            <Link to="/users/new" className="btn btn-primary">
                                <FiPlus /> Nuevo Usuario
                            </Link>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Usuario</th>
                                        <th>Rol</th>
                                        <th>Estado</th>
                                        <th style={{ textAlign: 'center' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(user => {
                                        const roleColor = ROLE_COLORS[user.role] || ROLE_COLORS.seller;
                                        const isDefaultAdmin = user.email === 'admin@loteclick.com';

                                        return (
                                            <tr key={user.id}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{
                                                            width: '40px',
                                                            height: '40px',
                                                            borderRadius: '50%',
                                                            background: `linear-gradient(135deg, ${roleColor.color}, ${roleColor.color}80)`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white',
                                                            fontWeight: 600,
                                                            fontSize: '1rem'
                                                        }}>
                                                            {user.name?.charAt(0).toUpperCase() || 'U'}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 500 }}>{user.name}</div>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                <FiMail size={12} />
                                                                {user.email}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span
                                                        className="badge"
                                                        style={{
                                                            background: roleColor.bg,
                                                            color: roleColor.color,
                                                            border: `1px solid ${roleColor.border}`
                                                        }}
                                                    >
                                                        <FiShield style={{ marginRight: '4px' }} />
                                                        {ROLE_LABELS[user.role] || user.role}
                                                    </span>
                                                </td>
                                                <td>
                                                    {user.isActive ? (
                                                        <span className="badge" style={{ background: '#10b98120', color: '#10b981' }}>
                                                            <FiCheck /> Activo
                                                        </span>
                                                    ) : (
                                                        <span className="badge" style={{ background: '#ef444420', color: '#ef4444' }}>
                                                            <FiX /> Inactivo
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                        <Link
                                                            to={`/users/${user.id}/edit`}
                                                            className="btn btn-sm btn-secondary"
                                                            title="Editar"
                                                        >
                                                            <FiEdit2 />
                                                        </Link>
                                                        <button
                                                            className="btn btn-sm btn-danger"
                                                            onClick={() => setDeleteConfirm(user.id)}
                                                            title="Eliminar"
                                                            disabled={isDefaultAdmin}
                                                            style={isDefaultAdmin ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
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
                            <p>¿Estás seguro de que deseas eliminar este usuario?</p>
                            <p style={{ color: 'var(--text-secondary)' }}>Esta acción no se puede deshacer.</p>
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

export default UserList;
