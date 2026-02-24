import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiBell,
    FiCheck,
    FiCheckCircle,
    FiAlertTriangle,
    FiDollarSign,
    FiTag,
    FiClock,
    FiInbox
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';
import EmptyState from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/formatters';

const TYPE_CONFIG = {
    overdue_installment: {
        icon: FiAlertTriangle,
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.12)',
        label: 'Cuota Vencida'
    },
    discount_request: {
        icon: FiTag,
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.12)',
        label: 'Descuento'
    },
    payment_received: {
        icon: FiDollarSign,
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.12)',
        label: 'Pago'
    },
    general: {
        icon: FiBell,
        color: '#6366f1',
        bg: 'rgba(99,102,241,0.12)',
        label: 'General'
    }
};

function NotificationList() {
    const navigate = useNavigate();
    const { currentUser, isPartner } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all' | 'unread'

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            let result;
            if (isPartner() && currentUser?.id) {
                result = await notificationService.getByPartner(currentUser.id);
            } else {
                result = await notificationService.getAll();
            }
            if (!result.error && result.data) {
                setNotifications(result.data);
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
        setLoading(false);
    }, [currentUser, isPartner]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handleMarkAsRead = async (id, e) => {
        e.stopPropagation();
        await notificationService.markAsRead(id);
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
        );
    };

    const handleMarkAllRead = async () => {
        const unread = notifications.filter(n => !n.is_read);
        await Promise.all(unread.map(n => notificationService.markAsRead(n.id)));
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    };

    const handleClick = async (notification) => {
        // Mark as read
        if (!notification.is_read) {
            await notificationService.markAsRead(notification.id);
            setNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, is_read: 1 } : n)
            );
        }

        // Navigate to referenced resource (only for roles that have access)
        if (notification.reference_type === 'installment' && notification.reference_id) {
            navigate('/payments');
        } else if (notification.reference_type === 'sale' && notification.reference_id && !isPartner()) {
            navigate(`/sales/${notification.reference_id}`);
        } else if (notification.reference_type === 'project' && notification.reference_id) {
            navigate(`/projects/${notification.reference_id}`);
        }
        // Partners stay on notifications page — the message contains all relevant details
    };

    const getTimeAgo = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `hace ${diffMins}m`;
        if (diffHours < 24) return `hace ${diffHours}h`;
        if (diffDays < 7) return `hace ${diffDays}d`;
        return formatDate(dateStr);
    };

    const filtered = filter === 'unread'
        ? notifications.filter(n => !n.is_read)
        : notifications;

    const unreadCount = notifications.filter(n => !n.is_read).length;

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Cargando notificaciones...</p>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="page-header-content">
                    <h1><FiBell /> Notificaciones</h1>
                    <p>
                        {unreadCount > 0
                            ? `Tienes ${unreadCount} notificación${unreadCount !== 1 ? 'es' : ''} sin leer`
                            : 'Estás al día con todas tus notificaciones'
                        }
                    </p>
                </div>
                <div className="page-header-actions">
                    {unreadCount > 0 && (
                        <button className="btn btn-secondary" onClick={handleMarkAllRead}>
                            <FiCheckCircle /> Marcar todas como leídas
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="card mb-6">
                <div style={{ display: 'flex', gap: 'var(--spacing-2)', padding: 'var(--spacing-2)' }}>
                    <button
                        className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                        onClick={() => setFilter('all')}
                    >
                        Todas ({notifications.length})
                    </button>
                    <button
                        className={`btn ${filter === 'unread' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                        onClick={() => setFilter('unread')}
                    >
                        No leídas ({unreadCount})
                    </button>
                </div>
            </div>

            {/* Notification List */}
            {filtered.length === 0 ? (
                <EmptyState
                    icon={FiInbox}
                    title={filter === 'unread' ? 'Sin notificaciones pendientes' : 'Sin notificaciones'}
                    description={filter === 'unread'
                        ? 'Has leído todas tus notificaciones'
                        : 'Aún no tienes notificaciones en el sistema'
                    }
                />
            ) : (
                <div className="card" style={{ overflow: 'hidden' }}>
                    {filtered.map((notification, idx) => {
                        const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.general;
                        const Icon = config.icon;
                        const isUnread = !notification.is_read;

                        return (
                            <div
                                key={notification.id}
                                onClick={() => handleClick(notification)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 'var(--spacing-4)',
                                    padding: 'var(--spacing-5) var(--spacing-6)',
                                    cursor: 'pointer',
                                    background: isUnread ? 'var(--bg-tertiary)' : 'transparent',
                                    borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-primary)' : 'none',
                                    transition: 'background 0.15s ease',
                                    position: 'relative'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = isUnread ? 'var(--bg-tertiary)' : 'transparent'}
                            >
                                {/* Unread indicator */}
                                {isUnread && (
                                    <div style={{
                                        position: 'absolute',
                                        left: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: 'var(--color-primary-500)'
                                    }} />
                                )}

                                {/* Icon */}
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: 'var(--radius-lg)',
                                    background: config.bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <Icon size={18} color={config.color} />
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: '2px' }}>
                                        <h4 style={{
                                            margin: 0,
                                            fontSize: 'var(--font-size-base)',
                                            fontWeight: isUnread ? 600 : 500,
                                            color: 'var(--text-primary)'
                                        }}>
                                            {notification.title}
                                        </h4>
                                        <span className="badge" style={{
                                            background: config.bg,
                                            color: config.color,
                                            fontSize: '0.65rem',
                                            padding: '1px 6px'
                                        }}>
                                            {config.label}
                                        </span>
                                    </div>
                                    <p style={{
                                        margin: 0,
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--text-muted)',
                                        lineHeight: 1.4,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical'
                                    }}>
                                        {notification.message}
                                    </p>
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--text-muted)',
                                        marginTop: '4px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <FiClock size={10} />
                                        {getTimeAgo(notification.created_at)}
                                    </span>
                                </div>

                                {/* Mark as read button */}
                                {isUnread && (
                                    <button
                                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                                        title="Marcar como leída"
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: 'var(--spacing-2)',
                                            borderRadius: 'var(--radius-md)',
                                            color: 'var(--text-muted)',
                                            transition: 'all 0.15s ease',
                                            flexShrink: 0
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.color = 'var(--color-primary-500)';
                                            e.currentTarget.style.background = 'var(--bg-secondary)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.color = 'var(--text-muted)';
                                            e.currentTarget.style.background = 'none';
                                        }}
                                    >
                                        <FiCheck size={18} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default NotificationList;
