import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
    FiSave,
    FiX,
    FiDollarSign,
    FiFileText,
    FiFolder,
    FiTag,
    FiCalendar,
    FiUser,
    FiArrowLeft,
    FiUpload,
    FiGrid,
    FiAlertCircle
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { storageService } from '../../services/storageService';
import { pickImage } from '../../lib/cameraUtils';
import { formatCurrency } from '../../lib/formatters';

const EXPENSE_CATEGORIES = [
    {
        group: 'Operativos', items: [
            { value: 'commissions', label: 'Comisiones', description: 'Pagos a comisionistas' },
            { value: 'signatures', label: 'Firmas y Escrituras', description: 'Escrituras, firmas notariales' },
            { value: 'construction', label: 'Obras', description: 'Construcción, materiales, mano de obra' },
        ]
    },
    {
        group: 'Servicios Públicos', items: [
            { value: 'utilities_water', label: 'Agua', description: 'Servicio público de agua' },
            { value: 'utilities_energy', label: 'Energía', description: 'Servicio público de energía' },
            { value: 'utilities_internet', label: 'Internet', description: 'Servicio de internet' },
        ]
    },
    {
        group: 'Administrativos', items: [
            { value: 'rent', label: 'Arriendos', description: 'Alquileres de oficina, equipos' },
            { value: 'payroll', label: 'Nómina', description: 'Salarios y prestaciones' },
            { value: 'employee_loans', label: 'Préstamo Empleados', description: 'Anticipos y préstamos a empleados' },
            { value: 'legal', label: 'Legal', description: 'Permisos, abogados, trámites' },
            { value: 'marketing', label: 'Marketing', description: 'Publicidad, promociones' },
            { value: 'administrative', label: 'Administrativo', description: 'Oficina, papelería, otros admin' },
            { value: 'other', label: 'Otros', description: 'Gastos varios' },
        ]
    },
];

// Flat list for lookups
const EXPENSE_CATEGORIES_FLAT = EXPENSE_CATEGORIES.flatMap(g => g.items);

// Fixed authentication cost when a sale falls through
const AUTHENTICATION_COST = 10000;

function ExpenseForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { state, addExpense, updateExpense, getExpenseById, getProjectById, getSalesByProject } = useApp();
    const isEditing = Boolean(id);

    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        projectId: '',
        partnerId: '',
        category: 'other',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        selectedLots: [],
    });

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [attachmentPreview, setAttachmentPreview] = useState(null);

    // Whether category is "signatures" (Firmas y Escrituras)
    const isSignatures = formData.category === 'signatures';

    // Load existing expense if editing
    useEffect(() => {
        if (isEditing) {
            const expense = getExpenseById(id);
            if (expense) {
                setFormData({
                    description: expense.description || '',
                    amount: expense.amount?.toString() || '',
                    projectId: expense.projectId || '',
                    partnerId: expense.partnerId || '',
                    category: expense.category || 'other',
                    date: expense.date || new Date().toISOString().split('T')[0],
                    notes: expense.notes || '',
                    selectedLots: expense.selectedLots || [],
                });
                // Show existing attachment preview
                if (expense.attachment) {
                    setAttachmentPreview(expense.attachment);
                }
            } else {
                navigate('/expenses');
            }
        }
    }, [id, isEditing, getExpenseById, navigate]);

    // Get partners from selected project
    const selectedProject = formData.projectId ? getProjectById(formData.projectId) : null;
    const projectPartners = selectedProject?.partners || [];

    // Get sold lots for the selected project (for signatures multi-select)
    const projectLots = selectedProject?.lots || [];
    const soldLots = projectLots.filter(l => l.status === 'sold');

    // Auto-fill description when category changes to "signatures"
    useEffect(() => {
        if (isSignatures && !isEditing) {
            setFormData(prev => ({
                ...prev,
                description: 'Julio Ricardo',
            }));
        }
    }, [isSignatures, isEditing]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear partner if project changes
        if (name === 'projectId') {
            setFormData(prev => ({
                ...prev,
                partnerId: '',
                selectedLots: [],
            }));
        }

        // When category changes away from signatures, clear selected lots and reset description
        if (name === 'category' && value !== 'signatures') {
            setFormData(prev => ({
                ...prev,
                selectedLots: [],
            }));
        }

        // Clear error when field changes
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: null
            }));
        }
    };

    // Handle lot checkbox toggle for multi-select
    const handleLotToggle = (lotId) => {
        setFormData(prev => {
            const isSelected = prev.selectedLots.some(sl => sl.lotId === lotId);
            let newSelectedLots;
            if (isSelected) {
                newSelectedLots = prev.selectedLots.filter(sl => sl.lotId !== lotId);
            } else {
                newSelectedLots = [...prev.selectedLots, { lotId, isFallen: false }];
            }
            return { ...prev, selectedLots: newSelectedLots };
        });
    };

    // Toggle "sale fell through" status for a lot
    const handleLotFallenToggle = (lotId) => {
        setFormData(prev => ({
            ...prev,
            selectedLots: prev.selectedLots.map(sl =>
                sl.lotId === lotId ? { ...sl, isFallen: !sl.isFallen } : sl
            )
        }));
    };

    // Calculate total amount based on selected lots
    const getCalculatedAmount = () => {
        if (!isSignatures || formData.selectedLots.length === 0) return null;
        // We don't auto-set a price since price per deed varies. 
        // But for fallen sales, we can show the authentication-only cost.
        const fallenCount = formData.selectedLots.filter(sl => sl.isFallen).length;
        const normalCount = formData.selectedLots.length - fallenCount;
        return { normalCount, fallenCount, authCost: fallenCount * AUTHENTICATION_COST };
    };

    const calculatedInfo = getCalculatedAmount();

    const validate = () => {
        const newErrors = {};

        if (!formData.description.trim()) {
            newErrors.description = 'La descripción es requerida';
        }

        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            newErrors.amount = 'El monto debe ser mayor a 0';
        }

        if (!formData.projectId) {
            newErrors.projectId = 'Selecciona un proyecto';
        }

        if (!formData.category) {
            newErrors.category = 'Selecciona una categoría';
        }

        if (!formData.date) {
            newErrors.date = 'La fecha es requerida';
        }

        if (isSignatures && formData.selectedLots.length === 0) {
            newErrors.selectedLots = 'Selecciona al menos un lote para registrar la escritura';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) return;

        setSubmitting(true);

        try {
            let attachmentUrl = formData.attachment || null;

            // Upload attachment if new file selected
            if (attachmentFile) {
                const { data: uploadData } = await storageService.uploadFile(attachmentFile, 'expenses');
                if (uploadData) attachmentUrl = uploadData.url || uploadData;
            }

            const expenseData = {
                ...formData,
                amount: parseFloat(formData.amount),
                attachment: attachmentUrl,
                selectedLots: isSignatures ? formData.selectedLots : null,
            };

            if (isEditing) {
                await updateExpense({ ...expenseData, id });
            } else {
                await addExpense(expenseData);
            }

            navigate('/expenses');
        } catch (error) {
            console.error('Error saving expense:', error);
        } finally {
            setSubmitting(false);
        }
    };

    // Find sale info for a lot (to determine buyer name)
    const getSaleForLot = (lotId) => {
        if (!formData.projectId) return null;
        const sales = state.sales.filter(s =>
            (s.projectId === formData.projectId || s.project_id === formData.projectId) &&
            (s.lotId === lotId || s.lot_id === lotId)
        );
        return sales[0] || null;
    };

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <Link to="/expenses" className="btn btn-secondary btn-sm" style={{ marginBottom: '0.5rem' }}>
                        <FiArrowLeft /> Volver
                    </Link>
                    <h1>{isEditing ? 'Editar Gasto' : 'Nuevo Gasto'}</h1>
                    <p>{isEditing ? 'Modifica la información del gasto' : 'Registra un nuevo gasto del proyecto'}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="card">
                    <div className="card-header">
                        <h3><FiFileText /> Información del Gasto</h3>
                    </div>
                    <div className="card-body">
                        {/* Category FIRST — so it controls the description behavior */}
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">
                                    <FiTag style={{ marginRight: '0.5rem' }} />
                                    Categoría *
                                </label>
                                <select
                                    name="category"
                                    className={`form-control ${errors.category ? 'error' : ''}`}
                                    value={formData.category}
                                    onChange={handleChange}
                                >
                                    {EXPENSE_CATEGORIES.map(group => (
                                        <optgroup key={group.group} label={group.group}>
                                            {group.items.map(cat => (
                                                <option key={cat.value} value={cat.value}>
                                                    {cat.label} - {cat.description}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                                {errors.category && <span className="form-error">{errors.category}</span>}
                            </div>

                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">
                                    <FiCalendar style={{ marginRight: '0.5rem' }} />
                                    Fecha *
                                </label>
                                <input
                                    type="date"
                                    name="date"
                                    className={`form-control ${errors.date ? 'error' : ''}`}
                                    value={formData.date}
                                    onChange={handleChange}
                                />
                                {errors.date && <span className="form-error">{errors.date}</span>}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group" style={{ flex: 2 }}>
                                <label className="form-label">
                                    <FiFileText style={{ marginRight: '0.5rem' }} />
                                    Descripción *
                                    {isSignatures && (
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                                            (Fijo para Firmas y Escrituras)
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    name="description"
                                    className={`form-control ${errors.description ? 'error' : ''}`}
                                    value={formData.description}
                                    onChange={handleChange}
                                    placeholder="Ej: Compra de materiales de construcción"
                                    readOnly={isSignatures}
                                    style={isSignatures ? { backgroundColor: 'var(--bg-secondary)', fontWeight: 600 } : {}}
                                />
                                {errors.description && <span className="form-error">{errors.description}</span>}
                            </div>

                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">
                                    <FiDollarSign style={{ marginRight: '0.5rem' }} />
                                    Monto *
                                </label>
                                <input
                                    type="number"
                                    name="amount"
                                    className={`form-control ${errors.amount ? 'error' : ''}`}
                                    value={formData.amount}
                                    onChange={handleChange}
                                    placeholder="0"
                                    min="0"
                                    step="1000"
                                />
                                {errors.amount && <span className="form-error">{errors.amount}</span>}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">
                                    <FiFolder style={{ marginRight: '0.5rem' }} />
                                    Proyecto *
                                </label>
                                <select
                                    name="projectId"
                                    className={`form-control ${errors.projectId ? 'error' : ''}`}
                                    value={formData.projectId}
                                    onChange={handleChange}
                                >
                                    <option value="">Seleccionar proyecto</option>
                                    {state.projects.map(project => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.projectId && <span className="form-error">{errors.projectId}</span>}
                            </div>

                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">
                                    <FiUser style={{ marginRight: '0.5rem' }} />
                                    Responsable del Gasto
                                </label>
                                <select
                                    name="partnerId"
                                    className="form-control"
                                    value={formData.partnerId}
                                    onChange={handleChange}
                                    disabled={!formData.projectId}
                                >
                                    <option value="">Sin asignar</option>
                                    <option value="office">🏢 Oficina</option>
                                    {projectPartners.map(partner => (
                                        <option key={partner.id} value={partner.id}>
                                            {partner.name} ({partner.percentage}%)
                                        </option>
                                    ))}
                                </select>
                                {!formData.projectId && (
                                    <span className="form-hint">Selecciona primero un proyecto</span>
                                )}
                            </div>
                        </div>

                        {/* Multi-select Lots for Signatures/Escrituras */}
                        {isSignatures && formData.projectId && (
                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label className="form-label">
                                    <FiGrid style={{ marginRight: '0.5rem' }} />
                                    Lotes para Escritura *
                                </label>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    Selecciona los lotes vendidos para los cuales se registra pago de escritura. Un pago por lote.
                                </p>

                                {soldLots.length === 0 ? (
                                    <div style={{
                                        padding: '1rem',
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                        borderRadius: 'var(--radius-md)',
                                        color: '#b45309',
                                        fontSize: '0.9rem'
                                    }}>
                                        <FiAlertCircle style={{ marginRight: '0.5rem' }} />
                                        No hay lotes vendidos en este proyecto.
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                        gap: '0.75rem'
                                    }}>
                                        {soldLots.map(lot => {
                                            const selectedEntry = formData.selectedLots.find(sl => sl.lotId === lot.id);
                                            const isSelected = !!selectedEntry;
                                            const isFallen = selectedEntry?.isFallen || false;
                                            const sale = getSaleForLot(lot.id);
                                            const clientName = sale ? (state.clients.find(c => c.id === sale.clientId)?.name || 'Cliente') : '';

                                            return (
                                                <div
                                                    key={lot.id}
                                                    style={{
                                                        padding: '0.75rem 1rem',
                                                        border: `2px solid ${isSelected ? (isFallen ? '#f97316' : 'var(--primary-color, #6366f1)') : 'var(--border-color)'}`,
                                                        borderRadius: 'var(--radius-lg)',
                                                        cursor: 'pointer',
                                                        background: isSelected
                                                            ? (isFallen ? 'rgba(249, 115, 22, 0.08)' : 'rgba(99, 102, 241, 0.08)')
                                                            : 'transparent',
                                                        transition: 'all 0.2s ease',
                                                    }}
                                                    onClick={() => handleLotToggle(lot.id)}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => { }}
                                                                style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color, #6366f1)' }}
                                                            />
                                                            <div>
                                                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                                                    Lote #{lot.number}
                                                                </div>
                                                                {clientName && (
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                                        {clientName}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {lot.price && (
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                                {formatCurrency(lot.price)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Fallen sale toggle */}
                                                    {isSelected && (
                                                        <div
                                                            style={{
                                                                marginTop: '0.5rem',
                                                                paddingTop: '0.5rem',
                                                                borderTop: '1px solid var(--border-color)',
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <label style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                cursor: 'pointer',
                                                                fontSize: '0.8rem',
                                                                color: isFallen ? '#f97316' : 'var(--text-secondary)',
                                                            }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isFallen}
                                                                    onChange={() => handleLotFallenToggle(lot.id)}
                                                                    style={{ accentColor: '#f97316' }}
                                                                />
                                                                <FiAlertCircle style={{ flexShrink: 0 }} />
                                                                Venta caída — Solo autenticación (${AUTHENTICATION_COST.toLocaleString()})
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {errors.selectedLots && <span className="form-error">{errors.selectedLots}</span>}

                                {/* Summary for signatures */}
                                {calculatedInfo && formData.selectedLots.length > 0 && (
                                    <div style={{
                                        marginTop: '1rem',
                                        padding: '1rem',
                                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid rgba(99, 102, 241, 0.2)',
                                    }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                            Resumen de escrituras:
                                        </div>
                                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                            {calculatedInfo.normalCount > 0 && (
                                                <span style={{ fontSize: '0.9rem' }}>
                                                    ✅ {calculatedInfo.normalCount} lote{calculatedInfo.normalCount !== 1 ? 's' : ''} con escritura normal
                                                </span>
                                            )}
                                            {calculatedInfo.fallenCount > 0 && (
                                                <span style={{ fontSize: '0.9rem', color: '#f97316' }}>
                                                    ⚠️ {calculatedInfo.fallenCount} venta{calculatedInfo.fallenCount !== 1 ? 's' : ''} caída{calculatedInfo.fallenCount !== 1 ? 's' : ''} — Solo autenticación: {formatCurrency(calculatedInfo.authCost)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Notas Adicionales</label>
                            <textarea
                                name="notes"
                                className="form-control"
                                value={formData.notes}
                                onChange={handleChange}
                                placeholder="Información adicional sobre el gasto..."
                                rows="3"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                <FiUpload style={{ marginRight: '0.5rem' }} />
                                Adjunto (factura, recibo, etc.)
                            </label>
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={async () => {
                                    const result = await pickImage({ allowPdf: true });
                                    if (result) {
                                        setAttachmentFile(result.file);
                                        setAttachmentPreview(result.preview);
                                    }
                                }}
                                style={{ width: '100%', padding: '1rem' }}
                            >
                                <FiUpload /> Tomar foto o seleccionar archivo
                            </button>
                            {attachmentPreview && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <img src={attachmentPreview} alt="Vista previa" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                                </div>
                            )}
                            {attachmentFile && !attachmentPreview && (
                                <div style={{ marginTop: '0.5rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                    📎 {attachmentFile.name}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <Link to="/expenses" className="btn btn-secondary">
                        <FiX /> Cancelar
                    </Link>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                        <FiSave /> {submitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Guardar')}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ExpenseForm;
