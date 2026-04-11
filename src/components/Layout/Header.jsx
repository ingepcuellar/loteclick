import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiMenu, FiSearch, FiBell, FiChevronRight, FiLogOut, FiUser, FiChevronDown } from 'react-icons/fi';
import { useAuth, ROLE_LABELS } from '../../context/AuthContext';
import { brand } from '../../config/brandConfig';

const ROLE_COLORS = {
    admin: '#3b82f6',
    seller: '#10b981',
    partner: '#8b5cf6'
};

function Header({ onMenuClick }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, logout } = useAuth();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowUserMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getPageTitle = () => {
        const path = location.pathname;

        if (path === '/') return 'Dashboard';
        if (path.startsWith('/projects')) {
            if (path.includes('/new')) return 'Nuevo Proyecto';
            if (path.includes('/edit')) return 'Editar Proyecto';
            return 'Proyectos';
        }
        if (path.startsWith('/clients')) {
            if (path.includes('/new')) return 'Nuevo Cliente';
            if (path.includes('/edit')) return 'Editar Cliente';
            return 'Clientes';
        }
        if (path.startsWith('/sales')) {
            if (path.includes('/new')) return 'Nueva Venta';
            return 'Ventas';
        }
        if (path.startsWith('/payments')) {
            if (path.includes('/new')) return 'Nuevo Pago';
            return 'Pagos';
        }
        if (path.startsWith('/expenses')) {
            if (path.includes('/new')) return 'Nuevo Gasto';
            if (path.includes('/edit')) return 'Editar Gasto';
            return 'Gastos';
        }
        if (path.startsWith('/users')) {
            if (path.includes('/new')) return 'Nuevo Usuario';
            if (path.includes('/edit')) return 'Editar Usuario';
            return 'Usuarios';
        }
        if (path.startsWith('/reports')) return 'Reportes';

        return brand.appName;
    };

    const getBreadcrumbs = () => {
        const path = location.pathname;
        const crumbs = ['Inicio'];

        if (path.startsWith('/projects')) {
            crumbs.push('Proyectos');
            if (path.includes('/new')) crumbs.push('Nuevo');
        }
        if (path.startsWith('/clients')) {
            crumbs.push('Clientes');
            if (path.includes('/new')) crumbs.push('Nuevo');
        }
        if (path.startsWith('/sales')) {
            crumbs.push('Ventas');
            if (path.includes('/new')) crumbs.push('Nueva');
        }
        if (path.startsWith('/payments')) {
            crumbs.push('Pagos');
            if (path.includes('/new')) crumbs.push('Nuevo');
        }
        if (path.startsWith('/expenses')) {
            crumbs.push('Gastos');
            if (path.includes('/new')) crumbs.push('Nuevo');
        }
        if (path.startsWith('/users')) {
            crumbs.push('Usuarios');
            if (path.includes('/new')) crumbs.push('Nuevo');
        }
        if (path.startsWith('/reports')) crumbs.push('Reportes');

        return crumbs;
    };

    const breadcrumbs = getBreadcrumbs();
    const roleColor = ROLE_COLORS[currentUser?.role] || ROLE_COLORS.seller;

    return (
        <header className="header">
            <div className="header-left">
                <button className="mobile-menu-btn" onClick={onMenuClick}>
                    <FiMenu />
                </button>

                <div>
                    <h1 className="header-title">{getPageTitle()}</h1>
                    <div className="header-breadcrumb">
                        {breadcrumbs.map((crumb, idx) => (
                            <span key={idx}>
                                {idx > 0 && <FiChevronRight size={12} />}
                                <span>{crumb}</span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="header-right">
                <div className="header-search">
                    <FiSearch className="header-search-icon" />
                    <input type="text" placeholder="Buscar..." />
                </div>

                <div className="header-actions">
                    <button className="header-action-btn">
                        <FiBell />
                    </button>
                </div>

                {/* User Menu */}
                <div className="user-menu" ref={menuRef}>
                    <div
                        className="user-menu-trigger"
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <div
                            className="user-avatar"
                            style={{
                                background: `linear-gradient(135deg, ${roleColor}, ${roleColor}80)`,
                                color: 'white'
                            }}
                        >
                            {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="user-info">
                            <div className="user-name">{currentUser?.name || 'Usuario'}</div>
                            <div className="user-role">{ROLE_LABELS[currentUser?.role] || 'Usuario'}</div>
                        </div>
                        <FiChevronDown
                            style={{
                                transition: 'transform 0.2s',
                                transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0deg)'
                            }}
                        />
                    </div>

                    {/* Dropdown Menu */}
                    {showUserMenu && (
                        <div className="user-dropdown">
                            <div className="user-dropdown-header">
                                <div style={{ fontWeight: 600 }}>{currentUser?.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {currentUser?.email}
                                </div>
                            </div>
                            <div className="user-dropdown-divider"></div>
                            <button
                                className="user-dropdown-item"
                                onClick={() => {
                                    setShowUserMenu(false);
                                    navigate('/profile');
                                }}
                            >
                                <FiUser /> Mi Perfil
                            </button>
                            <div className="user-dropdown-divider"></div>
                            <button
                                className="user-dropdown-item user-dropdown-item-danger"
                                onClick={handleLogout}
                            >
                                <FiLogOut /> Cerrar Sesión
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

export default Header;
