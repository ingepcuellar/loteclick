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
    FiUpload
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { storageService } from '../../services/storageService';

const EXPENSE_CATEGORIES = [
    {
        group: 'Operativos', items: [
            { value: 'commissions', label: 'Comisiones', description: 'Pagos a comisionistas' },
            { value: 'signatures', label: 'Firmas', description: 'Escrituras, firmas notariales' },
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

function ExpenseForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { state, addExpense, updateExpense, getExpenseById, getProjectById } = useApp();
    const isEditing = Boolean(id);

    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        projectId: '',
        partnerId: '',
        category: 'other',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [attachmentPreview, setAttachmentPreview] = useState(null);

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
                    notes: expense.notes || ''
                });
            } else {
                navigate('/expenses');
            }
        }
    }, [id, isEditing, getExpenseById, navigate]);

    // Get partners from selected project
    const selectedProject = formData.projectId ? getProjectById(formData.projectId) : null;
    const projectPartners = selectedProject?.partners || [];

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
                partnerId: ''
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
                attachment: attachmentUrl
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
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 2 }}>
                                <label className="form-label">
                                    <FiFileText style={{ marginRight: '0.5rem' }} />
                                    Descripción *
                                </label>
                                <input
                                    type="text"
                                    name="description"
                                    className={`form-control ${errors.description ? 'error' : ''}`}
                                    value={formData.description}
                                    onChange={handleChange}
                                    placeholder="Ej: Compra de materiales de construcción"
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
                                    Socio Responsable
                                </label>
                                <select
                                    name="partnerId"
                                    className="form-control"
                                    value={formData.partnerId}
                                    onChange={handleChange}
                                    disabled={!formData.projectId || projectPartners.length === 0}
                                >
                                    <option value="">Sin asignar</option>
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
                            <input
                                type="file"
                                accept="image/*,.pdf"
                                className="form-control"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        setAttachmentFile(file);
                                        if (file.type.startsWith('image/')) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => setAttachmentPreview(ev.target.result);
                                            reader.readAsDataURL(file);
                                        } else {
                                            setAttachmentPreview(null);
                                        }
                                    }
                                }}
                            />
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
