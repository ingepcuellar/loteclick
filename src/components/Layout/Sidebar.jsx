import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    FiHome,
    FiFolder,
    FiUsers,
    FiShoppingCart,
    FiDollarSign,
    FiBarChart2,

    FiX,
    FiCreditCard,
    FiUserCheck,
    FiZap,
    FiBell,
    FiSmartphone
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';

function Sidebar({ isOpen, onClose }) {
    const location = useLocation();
    const { getStats } = useApp();
    const { isAdmin, isPartner, canAccessModule, state: authState } = useAuth();
    const stats = getStats();
    const [unreadCount, setUnreadCount] = useState(0);

    // Poll unread notifications count
    useEffect(() => {
        const currentUser = authState.currentUser;
        if (!currentUser) return;

        const fetchCount = async () => {
            try {
                // For partners, get their specific count; for admins, get all
                const recipientId = currentUser.role === 'partner' ? currentUser.id : null;
                const { data } = await notificationService.getUnreadCount(recipientId);
                if (data?.count !== undefined) {
                    setUnreadCount(parseInt(data.count) || 0);
                }
            } catch (err) {
                console.error('Error fetching notification count:', err);
            }
        };

        fetchCount();
        const interval = setInterval(fetchCount, 30000); // Poll every 30 seconds
        return () => clearInterval(interval);
    }, [authState.currentUser]);

    const navItems = [
        {
            section: 'Principal',
            items: [
                { path: isPartner() ? '/partner-dashboard' : '/', icon: FiHome, label: isPartner() ? 'Mi Dashboard' : 'Dashboard', module: 'dashboard' },
            ]
        },
        {
            section: 'Gestión',
            items: [
                { path: '/projects', icon: FiFolder, label: 'Proyectos', badge: stats.totalProjects, module: 'projects' },
                { path: '/clients', icon: FiUsers, label: 'Clientes', badge: stats.totalClients, module: 'clients' },
                { path: '/sales', icon: FiShoppingCart, label: 'Ventas', badge: stats.totalSales, module: 'sales' },
                { path: '/expenses', icon: FiDollarSign, label: 'Gastos', module: 'expenses' },
            ]
        },
        {
            section: 'Tesorería',
            items: [
                { path: '/payments', icon: FiCreditCard, label: 'Pagos', module: 'payments' },
                { path: '/disbursements', icon: FiDollarSign, label: 'Entregas a Socios', module: 'disbursements' },
            ]
        },
        {
            section: 'Servicios Públicos',
            items: [
                { path: '/utilities', icon: FiZap, label: 'Matrículas', module: 'utilities' },
            ]
        },
        {
            section: 'Notificaciones',
            items: [
                {
                    path: '/notifications',
                    icon: FiBell,
                    label: 'Notificaciones',
                    badge: unreadCount,
                    badgeStyle: unreadCount > 0 ? 'alert' : null,
                    module: 'dashboard' // Partners and admins can access
                },
            ]
        },
        {
            section: 'Análisis',
            items: [
                { path: '/reports', icon: FiBarChart2, label: 'Reportes', module: 'reports' },
            ]
        },
    ];

    // Add admin section if user is admin
    if (isAdmin()) {
        navItems.push({
            section: 'Administración',
            items: [
                { path: '/users', icon: FiUserCheck, label: 'Usuarios', module: 'users' },
                { path: '/push-diagnostic', icon: FiSmartphone, label: 'Push Diagnostic', module: 'users' },
            ]
        });
    }

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    // Filter items based on permissions
    const filterByPermission = (items) => {
        return items.filter(item => !item.module || canAccessModule(item.module));
    };

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            {/* Header */}
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <img src="/logo.png" alt="PredioClick" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div className="sidebar-brand">
                    <h1>PredioClick</h1>
                    <span>Gestión de Predios</span>
                </div>

                {/* Mobile Close Button */}
                <button className="mobile-menu-btn" onClick={onClose} style={{ marginLeft: 'auto' }}>
                    <FiX />
                </button>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                {navItems.map((section, idx) => {
                    const filteredItems = filterByPermission(section.items);
                    if (filteredItems.length === 0) return null;

                    return (
                        <div key={idx} className="nav-section">
                            <div className="nav-section-title">{section.section}</div>
                            {filteredItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                                    onClick={onClose}
                                >
                                    <span className="nav-item-icon">
                                        <item.icon />
                                    </span>
                                    <span>{item.label}</span>
                                    {item.badge > 0 && (
                                        <span
                                            className="nav-item-badge"
                                            style={item.badgeStyle === 'alert' ? {
                                                background: 'var(--color-error, #ef4444)',
                                                color: '#fff',
                                                animation: 'pulse 2s infinite'
                                            } : undefined}
                                        >
                                            {item.badge}
                                        </span>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    );
                })}
            </nav>


        </aside>
    );
}

export default Sidebar;
