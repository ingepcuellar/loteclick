import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    FiArrowLeft,
    FiEdit2,
    FiTrash2,
    FiDollarSign,
    FiFolder,
    FiTag,
    FiCalendar,
    FiUser,
    FiFileText,
    FiClock
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useState } from 'react';
import { formatCurrency, formatDateLong as formatDate } from '../../lib/formatters';

const EXPENSE_CATEGORIES = {
    commissions: { label: 'Comisiones', color: '#f97316' },
    signatures: { label: 'Firmas', color: '#6366f1' },
    construction: { label: 'Obras', color: '#3b82f6' },
    utilities_water: { label: 'Agua', color: '#06b6d4' },
    utilities_energy: { label: 'Energía', color: '#eab308' },
    utilities_internet: { label: 'Internet', color: '#8b5cf6' },
    rent: { label: 'Arriendos', color: '#14b8a6' },
    payroll: { label: 'Nómina', color: '#ec4899' },
    employee_loans: { label: 'Préstamo Empleados', color: '#a855f7' },
    legal: { label: 'Legal', color: '#8b5cf6' },
    marketing: { label: 'Marketing', color: '#ec4899' },
    administrative: { label: 'Administrativo', color: '#f59e0b' },
    infrastructure: { label: 'Infraestructura', color: '#3b82f6' },
    other: { label: 'Otros', color: '#6b7280' }
};

function ExpenseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getExpenseById, getProjectById, deleteExpense } = useApp();
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const expense = getExpenseById(id);

    if (!expense) {
        return (
            <div className="page-container">
                <div className="empty-state">
                    <FiDollarSign className="empty-state-icon" />
                    <h3>Gasto no encontrado</h3>
                    <p>El gasto que buscas no existe o ha sido eliminado</p>
                    <Link to="/expenses" className="btn btn-primary">
                        Volver a Gastos
                    </Link>
                </div>
            </div>
        );
    }

    const project = getProjectById(expense.projectId);
    const partner = project?.partners?.find(p => p.id === expense.partnerId);
    const category = EXPENSE_CATEGORIES[expense.category] || EXPENSE_CATEGORIES.other;



    const handleDelete = () => {
        deleteExpense(id);
        navigate('/expenses');
    };

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <Link to="/expenses" className="btn btn-secondary btn-sm" style={{ marginBottom: '0.5rem' }}>
                        <FiArrowLeft /> Volver
                    </Link>
                    <h1>{expense.description}</h1>
                    <p>Detalle del gasto registrado</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link to={`/expenses/${id}/edit`} className="btn btn-primary">
                        <FiEdit2 /> Editar
                    </Link>
                    <button className="btn btn-danger" onClick={() => setShowDeleteModal(true)}>
                        <FiTrash2 /> Eliminar
                    </button>
                </div>
            </div>

            {/* Main Info Card */}
            <div className="card">
                <div className="card-body">
                    {/* Amount Hero */}
                    <div style={{
                        textAlign: 'center',
                        padding: '2rem',
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1))',
                        borderRadius: 'var(--radius-lg)',
                        marginBottom: '2rem'
                    }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            Monto del Gasto
                        </div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#ef4444' }}>
                            {formatCurrency(expense.amount)}
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                        {/* Project */}
                        <div className="info-item">
                            <div className="info-label">
                                <FiFolder style={{ marginRight: '0.5rem', color: 'var(--primary-color)' }} />
                                Proyecto
                            </div>
                            <div className="info-value">
                                {project ? (
                                    <Link to={`/projects/${project.id}`} style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>
                                        {project.name}
                                    </Link>
                                ) : (
                                    'Proyecto no encontrado'
                                )}
                            </div>
                        </div>

                        {/* Category */}
                        <div className="info-item">
                            <div className="info-label">
                                <FiTag style={{ marginRight: '0.5rem', color: category.color }} />
                                Categoría
                            </div>
                            <div className="info-value">
                                <span
                                    className="badge"
                                    style={{
                                        background: `${category.color}20`,
                                        color: category.color,
                                        border: `1px solid ${category.color}40`
                                    }}
                                >
                                    {category.label}
                                </span>
                            </div>
                        </div>

                        {/* Date */}
                        <div className="info-item">
                            <div className="info-label">
                                <FiCalendar style={{ marginRight: '0.5rem', color: '#10b981' }} />
                                Fecha del Gasto
                            </div>
                            <div className="info-value" style={{ textTransform: 'capitalize' }}>
                                {formatDate(expense.date || expense.createdAt)}
                            </div>
                        </div>

                        {/* Partner */}
                        <div className="info-item">
                            <div className="info-label">
                                <FiUser style={{ marginRight: '0.5rem', color: '#8b5cf6' }} />
                                Socio Responsable
                            </div>
                            <div className="info-value">
                                {partner ? (
                                    <span>
                                        {partner.name} <span style={{ color: 'var(--text-secondary)' }}>({partner.percentage}%)</span>
                                    </span>
                                ) : (
                                    <span style={{ color: 'var(--text-secondary)' }}>Sin asignar</span>
                                )}
                            </div>
                        </div>

                        {/* Created At */}
                        <div className="info-item">
                            <div className="info-label">
                                <FiClock style={{ marginRight: '0.5rem', color: '#6b7280' }} />
                                Fecha de Registro
                            </div>
                            <div className="info-value" style={{ textTransform: 'capitalize' }}>
                                {formatDate(expense.createdAt)}
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    {expense.notes && (
                        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                            <div className="info-label" style={{ marginBottom: '0.75rem' }}>
                                <FiFileText style={{ marginRight: '0.5rem' }} />
                                Notas
                            </div>
                            <div style={{
                                padding: '1rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: 'var(--radius-md)',
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.6
                            }}>
                                {expense.notes}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Modal */}
            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Confirmar Eliminación</h3>
                        </div>
                        <div className="modal-body">
                            <p>¿Estás seguro de que deseas eliminar este gasto?</p>
                            <p><strong>{expense.description}</strong></p>
                            <p style={{ color: '#ef4444', fontWeight: 600 }}>{formatCurrency(expense.amount)}</p>
                            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
                                Esta acción no se puede deshacer.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn btn-danger" onClick={handleDelete}>
                                <FiTrash2 /> Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ExpenseDetail;
