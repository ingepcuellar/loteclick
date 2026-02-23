import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';

function StatCard({
    icon: Icon,
    label,
    value,
    trend,
    trendDirection,
    variant = 'primary',
    iconStyle,
}) {
    return (
        <div className="card">
            <div className="stat-card">
                <div
                    className={`stat-icon ${iconStyle ? '' : variant}`}
                    style={iconStyle || undefined}
                >
                    <Icon />
                </div>
                <div className="stat-content">
                    <h3>{value}</h3>
                    <p>{label}</p>
                    {trend && (
                        <div className={`stat-trend ${trendDirection || ''}`}>
                            {trendDirection === 'up' && (
                                <FiTrendingUp size={14} />
                            )}
                            {trendDirection === 'down' && (
                                <FiTrendingDown size={14} />
                            )}
                            <span>{trend}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default StatCard;
