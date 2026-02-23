import { Link } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';

function EmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    actionTo,
    onAction,
    style,
}) {
    return (
        <div className="empty-state" style={style}>
            {Icon && (
                <div className="empty-state-icon">
                    <Icon />
                </div>
            )}
            {title && <h3>{title}</h3>}
            {description && <p>{description}</p>}
            {actionLabel && actionTo && (
                <Link to={actionTo} className="btn btn-primary">
                    <FiPlus /> {actionLabel}
                </Link>
            )}
            {actionLabel && onAction && !actionTo && (
                <button className="btn btn-primary" onClick={onAction}>
                    <FiPlus /> {actionLabel}
                </button>
            )}
        </div>
    );
}

export default EmptyState;
