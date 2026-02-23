import { FiAlertTriangle, FiX } from 'react-icons/fi';

const VARIANTS = {
    danger: {
        color: 'var(--color-error)',
        bg: 'rgba(239, 68, 68, 0.1)',
        border: 'rgba(239, 68, 68, 0.3)',
    },
    warning: {
        color: 'var(--color-warning)',
        bg: 'rgba(245, 158, 11, 0.1)',
        border: 'rgba(245, 158, 11, 0.3)',
    },
    default: {
        color: 'var(--color-primary-400)',
        bg: 'rgba(16, 185, 129, 0.1)',
        border: 'rgba(16, 185, 129, 0.3)',
    },
};

function ConfirmModal({
    isOpen,
    title = '¿Estás seguro?',
    message = 'Esta acción no se puede deshacer.',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'danger',
    onConfirm,
    onCancel,
}) {
    if (!isOpen) return null;

    const v = VARIANTS[variant] || VARIANTS.default;

    return (
        <div className="confirm-modal-overlay" onClick={onCancel}>
            <div
                className="confirm-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <button className="confirm-modal-close" onClick={onCancel}>
                    <FiX />
                </button>

                <div
                    className="confirm-modal-icon"
                    style={{ background: v.bg, color: v.color }}
                >
                    <FiAlertTriangle size={28} />
                </div>

                <h3 className="confirm-modal-title">{title}</h3>
                <p className="confirm-modal-message">{message}</p>

                <div className="confirm-modal-actions">
                    <button className="btn btn-secondary" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button
                        className="btn"
                        style={{
                            background: v.color,
                            color: '#fff',
                            borderColor: v.color,
                        }}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmModal;
