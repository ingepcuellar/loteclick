import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    FiPlus,
    FiSearch,
    FiFilter,
    FiEdit2,
    FiTrash2,
    FiEye,
    FiDollarSign,
    FiFolder,
    FiCalendar,
    FiTag,
    FiImage,
    FiCreditCard
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { expenseService } from '../../services/expenseService';
import { bankAccountService } from '../../services/bankAccountService';
import { formatCurrency, formatDate } from '../../lib/formatters';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';

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
    desistimientos: { label: 'Desistimientos', color: '#ef4444' },
    other: { label: 'Otros', color: '#6b7280' }
};

const PAYMENT_METHODS = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    barter: 'Permuta'
};

function ExpenseList() {
    const { state, deleteExpense, getProjectById, getTotalExpensesByProject } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [bankAccounts, setBankAccounts] = useState([]);

    useEffect(() => {
        bankAccountService.getAll().then(({ data }) => {
            if (data) setBankAccounts(data);
        }).catch(console.error);
    }, []);

    // Calculate totals
    const totals = useMemo(() => {
        let filtered = state.expenses;

        if (filterProject) {
            filtered = filtered.filter(e => e.projectId === filterProject);
        }
        if (filterCategory) {
            filtered = filtered.filter(e => e.category === filterCategory);
        }
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(e =>
                e.description?.toLowerCase().includes(search)
            );
        }

        const total = filtered.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        return { filtered, total };
    }, [state.expenses, filterProject, filterCategory, searchTerm]);

    const handleDelete = (id) => {
        deleteExpense(id);
        setDeleteConfirm(null);
    };



    return (
        <div className="page-container">
            {/* Header */}
            <PageHeader
                title="Gastos"
                subtitle="Gestiona los gastos de tus proyectos"
                actions={
                    <Link to="/expenses/new" className="btn btn-primary">
                        <FiPlus /> Nuevo Gasto
                    </Link>
                }
            />

            {/* Stats Cards */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.5rem' }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                        <FiDollarSign />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{formatCurrency(totals.total)}</span>
                        <span className="stat-label">Total Gastos</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                        <FiFolder />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{totals.filtered.length}</span>
                        <span className="stat-label">Registros</span>
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
                                    placeholder="Buscar gastos..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ paddingLeft: '40px' }}
                                />
                            </div>
                        </div>
                        <button
                            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <FiFilter /> Filtros
                        </button>
                    </div>

                    {showFilters && (
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                                <label className="form-label">Proyecto</label>
                                <select
                                    className="form-control"
                                    value={filterProject}
                                    onChange={(e) => setFilterProject(e.target.value)}
                                >
                                    <option value="">Todos los proyectos</option>
                                    {state.projects.map(project => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                                <label className="form-label">Categoría</label>
                                <select
                                    className="form-control"
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                >
                                    <option value="">Todas las categorías</option>
                                    {Object.entries(EXPENSE_CATEGORIES).map(([key, cat]) => (
                                        <option key={key} value={key}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Expenses Table */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {totals.filtered.length === 0 ? (
                        <EmptyState
                            icon={FiDollarSign}
                            title="No hay gastos registrados"
                            description="Comienza agregando el primer gasto de tu proyecto"
                            actionLabel="Nuevo Gasto"
                            actionTo="/expenses/new"
                        />
                    ) : (
                        <>
                            <div className="table-responsive">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Descripción</th>
                                            <th>Proyecto</th>
                                            <th>Categoría</th>
                                            <th>Fecha</th>
                                            <th>Método</th>
                                            <th>Adjunto</th>
                                            <th style={{ textAlign: 'right' }}>Monto</th>
                                            <th style={{ textAlign: 'center' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {totals.filtered.map(expense => {
                                            const project = getProjectById(expense.projectId);
                                            const category = EXPENSE_CATEGORIES[expense.category] || EXPENSE_CATEGORIES.other;

                                            return (
                                                <tr key={expense.id}>
                                                    <td>
                                                        <div style={{ fontWeight: 500 }}>{expense.description}</div>
                                                        {expense.notes && (
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                                {expense.notes.substring(0, 50)}...
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <FiFolder style={{ color: 'var(--primary-color)' }} />
                                                            {project?.name || 'Sin proyecto'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span
                                                            className="badge"
                                                            style={{
                                                                background: `${category.color}20`,
                                                                color: category.color,
                                                                border: `1px solid ${category.color}40`
                                                            }}
                                                        >
                                                            <FiTag style={{ marginRight: '4px' }} />
                                                            {category.label}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                                            <FiCalendar />
                                                            {formatDate(expense.date || expense.createdAt)}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                                                            <FiCreditCard style={{ marginRight: '4px' }} />
                                                            {PAYMENT_METHODS[expense.paymentMethod || expense.payment_method] || 'Efectivo'}
                                                        </span>
                                                        {(expense.paymentMethod === 'transfer' || expense.payment_method === 'transfer') && (expense.bankAccountId || expense.bank_account_id) && (
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                                {bankAccounts.find(b => b.id === (expense.bankAccountId || expense.bank_account_id))?.bank_name || 'Cuenta'}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {expense.attachment ? (
                                                            <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                                                                <FiImage /> Sí
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: 'var(--text-secondary)' }}>-</span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>
                                                        {formatCurrency(expense.amount)}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                            <Link
                                                                to={`/expenses/${expense.id}`}
                                                                className="btn btn-sm btn-secondary"
                                                                title="Ver detalle"
                                                            >
                                                                <FiEye />
                                                            </Link>
                                                            <Link
                                                                to={`/expenses/${expense.id}/edit`}
                                                                className="btn btn-sm btn-secondary"
                                                                title="Editar"
                                                            >
                                                                <FiEdit2 />
                                                            </Link>
                                                            <button
                                                                className="btn btn-sm btn-danger"
                                                                onClick={() => setDeleteConfirm(expense.id)}
                                                                title="Eliminar"
                                                            >
                                                                <FiTrash2 />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan="6" style={{ textAlign: 'right', fontWeight: 600 }}>
                                                Total:
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444', fontSize: '1.1rem' }}>
                                                {formatCurrency(totals.total)}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="mobile-card-list">
                                {totals.filtered.map(expense => {
                                    const project = getProjectById(expense.projectId);
                                    const category = EXPENSE_CATEGORIES[expense.category] || EXPENSE_CATEGORIES.other;

                                    return (
                                        <Link to={`/expenses/${expense.id}`} key={expense.id} className="mobile-card-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                                            <div className="mobile-card-header">
                                                <div>
                                                    <div className="mobile-card-title">{expense.description}</div>
                                                    <div className="mobile-card-subtitle">{project?.name || 'Sin proyecto'}</div>
                                                </div>
                                                <span style={{ fontWeight: 700, color: '#ef4444' }}>
                                                    {formatCurrency(expense.amount)}
                                                </span>
                                            </div>
                                            <div className="mobile-card-body">
                                                <div className="mobile-card-row">
                                                    <span className="mobile-card-label">Categoría</span>
                                                    <span className="badge" style={{
                                                        background: `${category.color}20`,
                                                        color: category.color,
                                                        border: `1px solid ${category.color}40`,
                                                        fontSize: 'var(--font-size-xs)'
                                                    }}>
                                                        {category.label}
                                                    </span>
                                                </div>
                                                <div className="mobile-card-row">
                                                    <span className="mobile-card-label">Fecha</span>
                                                    <span className="mobile-card-value">{formatDate(expense.date || expense.createdAt)}</span>
                                                </div>
                                                <div className="mobile-card-row">
                                                    <span className="mobile-card-label">Método</span>
                                                    <span className="mobile-card-value">
                                                        {PAYMENT_METHODS[expense.paymentMethod || expense.payment_method] || 'Efectivo'}
                                                    </span>
                                                </div>
                                                <div className="mobile-card-row">
                                                    <span className="mobile-card-label">Adjunto</span>
                                                    <span className="mobile-card-value">
                                                        {expense.attachment ? (
                                                            <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                                <FiImage /> Sí
                                                            </span>
                                                        ) : 'Sin adjunto'}
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                                {totals.filtered.length > 0 && (
                                    <div className="mobile-card-item" style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444', fontSize: '1.1rem' }}>
                                        Total: {formatCurrency(totals.total)}
                                    </div>
                                )}
                            </div>
                        </>
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
                            <p>¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer.</p>
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

export default ExpenseList;
