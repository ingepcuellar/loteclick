import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    FiChevronRight,
    FiChevronLeft,
    FiCheck,
    FiPlus,
    FiTrash2,
    FiMapPin,
    FiGrid,
    FiUsers,
    FiSave
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../lib/formatters';

function ProjectWizard() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { addProject, updateProject, getProjectById, generateId } = useApp();

    const isEditing = !!id;

    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        description: '',
        numberOfLots: 1,
        partners: [],
        lots: [],
    });

    const [errors, setErrors] = useState({});

    // Load project data if editing
    useEffect(() => {
        if (isEditing) {
            const project = getProjectById(id);
            if (project) {
                setFormData({
                    name: project.name || '',
                    location: project.location || '',
                    description: project.description || '',
                    numberOfLots: project.lots?.length || 1,
                    partners: project.partners || [],
                    lots: project.lots || [],
                });
            } else {
                navigate('/projects');
            }
        }
    }, [id, isEditing]);

    const steps = [
        { number: 1, label: 'Información Básica', icon: FiMapPin },
        { number: 2, label: 'Socios', icon: FiUsers },
        { number: 3, label: 'Lotes', icon: FiGrid },
        { number: 4, label: 'Confirmación', icon: FiCheck },
    ];

    // Validate current step
    const validateStep = (step) => {
        const newErrors = {};

        if (step === 1) {
            if (!formData.name.trim()) newErrors.name = 'El nombre es requerido';
            if (!formData.location.trim()) newErrors.location = 'La ubicación es requerida';
            if (formData.numberOfLots < 1) newErrors.numberOfLots = 'Debe haber al menos 1 lote';
        }

        if (step === 2) {
            if (formData.partners.length === 0) {
                newErrors.partners = 'Debe agregar al menos un socio';
            } else {
                const totalPercentage = formData.partners.reduce((sum, p) => sum + parseFloat(p.percentage || 0), 0);
                if (Math.abs(totalPercentage - 100) > 0.01) {
                    newErrors.partners = `La suma de porcentajes debe ser 100% (actual: ${totalPercentage.toFixed(1)}%)`;
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle step navigation
    const nextStep = () => {
        if (validateStep(currentStep)) {
            if (currentStep === 1 && !isEditing) {
                // Generate lots based on numberOfLots
                const existingLots = formData.lots;
                const newLots = [];
                for (let i = 0; i < formData.numberOfLots; i++) {
                    const existing = existingLots[i];
                    newLots.push(existing || {
                        id: generateId(),
                        number: i + 1,
                        area: '',
                        price: '',
                        status: 'available',
                    });
                }
                setFormData(prev => ({ ...prev, lots: newLots }));
            }
            setCurrentStep(prev => Math.min(prev + 1, 4));
        }
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    // Partner management
    const addPartner = () => {
        setFormData(prev => ({
            ...prev,
            partners: [
                ...prev.partners,
                { id: generateId(), name: '', percentage: 0, document: '', phone: '' }
            ]
        }));
    };

    const updatePartner = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            partners: prev.partners.map((p, i) =>
                i === index ? { ...p, [field]: value } : p
            )
        }));
    };

    const removePartner = (index) => {
        setFormData(prev => ({
            ...prev,
            partners: prev.partners.filter((_, i) => i !== index)
        }));
    };

    // Lot management
    const updateLot = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            lots: prev.lots.map((l, i) =>
                i === index ? { ...l, [field]: value } : l
            )
        }));
    };

    // Handle save
    const handleSave = () => {
        if (!validateStep(1) || !validateStep(2)) {
            return;
        }

        const projectData = {
            name: formData.name,
            location: formData.location,
            description: formData.description,
            partners: formData.partners,
            lots: formData.lots,
        };

        if (isEditing) {
            updateProject({ ...projectData, id });
        } else {
            addProject(projectData);
        }

        navigate('/projects');
    };



    return (
        <div className="animate-fadeIn">
            {/* Stepper */}
            <div className="stepper">
                {steps.map((step, idx) => (
                    <div key={step.number} className="stepper-item">
                        {idx > 0 && (
                            <div className={`stepper-connector ${currentStep > step.number ? 'completed' : ''}`} />
                        )}
                        <div className={`stepper-item ${currentStep === step.number ? 'active' :
                            currentStep > step.number ? 'completed' : ''
                            }`}>
                            <div className="stepper-number">
                                {currentStep > step.number ? <FiCheck /> : step.number}
                            </div>
                            <span className="stepper-label">{step.label}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Step Content */}
            <div className="card">
                {/* Step 1: Basic Info */}
                {currentStep === 1 && (
                    <div className="animate-slideUp">
                        <div className="card-header">
                            <h3 className="card-title">
                                <FiMapPin className="card-title-icon" />
                                Información Básica del Proyecto
                            </h3>
                        </div>
                        <div className="card-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label required">Nombre del Proyecto</label>
                                    <input
                                        type="text"
                                        className={`form-input ${errors.name ? 'error' : ''}`}
                                        placeholder="Ej: Urbanización Los Pinos"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                    {errors.name && <span className="form-error">{errors.name}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Ubicación</label>
                                    <input
                                        type="text"
                                        className={`form-input ${errors.location ? 'error' : ''}`}
                                        placeholder="Ej: Vereda La Esperanza, Municipio"
                                        value={formData.location}
                                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                                    />
                                    {errors.location && <span className="form-error">{errors.location}</span>}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Descripción</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Descripción del proyecto..."
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label required">Número de Lotes</label>
                                    <input
                                        type="number"
                                        className={`form-input ${errors.numberOfLots ? 'error' : ''}`}
                                        min="1"
                                        value={formData.numberOfLots}
                                        onChange={(e) => setFormData(prev => ({ ...prev, numberOfLots: parseInt(e.target.value) || 1 }))}
                                        disabled={isEditing}
                                    />
                                    {errors.numberOfLots && <span className="form-error">{errors.numberOfLots}</span>}
                                    {isEditing && <span className="form-hint">No se puede modificar el número de lotes</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Partners */}
                {currentStep === 2 && (
                    <div className="animate-slideUp">
                        <div className="card-header">
                            <h3 className="card-title">
                                <FiUsers className="card-title-icon" />
                                Socios del Proyecto
                            </h3>
                            <button className="btn btn-primary btn-sm" onClick={addPartner}>
                                <FiPlus /> Agregar Socio
                            </button>
                        </div>
                        <div className="card-body">
                            {errors.partners && (
                                <div style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid var(--color-error)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 'var(--spacing-4)',
                                    marginBottom: 'var(--spacing-4)',
                                    color: 'var(--color-error)'
                                }}>
                                    {errors.partners}
                                </div>
                            )}

                            {formData.partners.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--spacing-8)' }}>
                                    <div className="empty-state-icon">
                                        <FiUsers />
                                    </div>
                                    <h3>Sin socios</h3>
                                    <p>Agrega al menos un socio para continuar</p>
                                    <button className="btn btn-primary btn-sm" onClick={addPartner}>
                                        <FiPlus /> Agregar Socio
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {formData.partners.map((partner, index) => (
                                        <div
                                            key={partner.id}
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-lg)',
                                                padding: 'var(--spacing-4)',
                                            }}
                                        >
                                            <div className="flex-between mb-4">
                                                <h4 style={{ margin: 0 }}>Socio {index + 1}</h4>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => removePartner(index)}
                                                    style={{ color: 'var(--color-error)' }}
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                            <div className="form-row">
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label">Nombre Completo</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="Nombre del socio"
                                                        value={partner.name}
                                                        onChange={(e) => updatePartner(index, 'name', e.target.value)}
                                                    />
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label">% Participación</label>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        min="0"
                                                        max="100"
                                                        step="0.1"
                                                        placeholder="25"
                                                        value={partner.percentage}
                                                        onChange={(e) => updatePartner(index, 'percentage', parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-row mt-4">
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label">Documento</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="CC 123456789"
                                                        value={partner.document}
                                                        onChange={(e) => updatePartner(index, 'document', e.target.value)}
                                                    />
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label">Teléfono</label>
                                                    <input
                                                        type="tel"
                                                        className="form-input"
                                                        placeholder="300 123 4567"
                                                        value={partner.phone}
                                                        onChange={(e) => updatePartner(index, 'phone', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Total Percentage */}
                                    <div className="flex-between" style={{
                                        background: 'var(--bg-secondary)',
                                        padding: 'var(--spacing-4)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <span>Total Participación:</span>
                                        <span style={{
                                            fontWeight: '700',
                                            color: Math.abs(formData.partners.reduce((sum, p) => sum + parseFloat(p.percentage || 0), 0) - 100) < 0.01
                                                ? 'var(--color-success)'
                                                : 'var(--color-error)'
                                        }}>
                                            {formData.partners.reduce((sum, p) => sum + parseFloat(p.percentage || 0), 0).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 3: Lots */}
                {currentStep === 3 && (
                    <div className="animate-slideUp">
                        <div className="card-header">
                            <h3 className="card-title">
                                <FiGrid className="card-title-icon" />
                                Configuración de Lotes
                            </h3>
                        </div>
                        <div className="card-body">
                            {/* Bulk Configuration */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(139, 195, 74, 0.05))',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--spacing-5)',
                                marginBottom: 'var(--spacing-6)'
                            }}>
                                <h4 style={{ marginBottom: 'var(--spacing-4)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                    <FiGrid /> Configuración Masiva
                                </h4>
                                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-4)' }}>
                                    Aplica el mismo área y precio a todos los lotes disponibles
                                </p>
                                <div className="form-row" style={{ alignItems: 'flex-end' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Área (m²)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="Ej: 120"
                                            id="bulk-area"
                                            min="0"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Precio ($)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="Ej: 50000000"
                                            id="bulk-price"
                                            min="0"
                                            step="100000"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => {
                                            const areaInput = document.getElementById('bulk-area');
                                            const priceInput = document.getElementById('bulk-price');
                                            const bulkArea = areaInput?.value;
                                            const bulkPrice = priceInput?.value;

                                            if (bulkArea || bulkPrice) {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    lots: prev.lots.map(lot => {
                                                        if (lot.status === 'sold') return lot;
                                                        return {
                                                            ...lot,
                                                            area: bulkArea || lot.area,
                                                            price: bulkPrice || lot.price
                                                        };
                                                    })
                                                }));
                                            }
                                        }}
                                    >
                                        Aplicar a Todos
                                    </button>
                                </div>
                            </div>

                            {/* Lots Table */}
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Lote #</th>
                                            <th>Área (m²)</th>
                                            <th>Precio</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.lots.map((lot, index) => (
                                            <tr key={lot.id}>
                                                <td>
                                                    <strong>Lote {lot.number}</strong>
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        placeholder="100"
                                                        style={{ width: '120px' }}
                                                        value={lot.area}
                                                        onChange={(e) => updateLot(index, 'area', e.target.value)}
                                                        disabled={lot.status === 'sold'}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        placeholder="50000000"
                                                        style={{ width: '180px' }}
                                                        value={lot.price}
                                                        onChange={(e) => updateLot(index, 'price', e.target.value)}
                                                        disabled={lot.status === 'sold'}
                                                    />
                                                </td>
                                                <td>
                                                    <span className={`badge ${lot.status === 'sold' ? 'badge-success' : 'badge-info'}`}>
                                                        {lot.status === 'sold' ? 'Vendido' : 'Disponible'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 4: Confirmation */}
                {currentStep === 4 && (
                    <div className="animate-slideUp">
                        <div className="card-header">
                            <h3 className="card-title">
                                <FiCheck className="card-title-icon" />
                                Confirmar Proyecto
                            </h3>
                        </div>
                        <div className="card-body">
                            {/* Project Summary */}
                            <div style={{
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--spacing-6)',
                                marginBottom: 'var(--spacing-6)'
                            }}>
                                <h4 style={{ marginBottom: 'var(--spacing-4)' }}>Información del Proyecto</h4>
                                <div className="grid grid-2" style={{ gap: 'var(--spacing-4)' }}>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Nombre:</span>
                                        <p style={{ margin: 0, fontWeight: '500' }}>{formData.name}</p>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Ubicación:</span>
                                        <p style={{ margin: 0, fontWeight: '500' }}>{formData.location}</p>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Número de Lotes:</span>
                                        <p style={{ margin: 0, fontWeight: '500' }}>{formData.lots.length}</p>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Número de Socios:</span>
                                        <p style={{ margin: 0, fontWeight: '500' }}>{formData.partners.length}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Partners Summary */}
                            <div style={{
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--spacing-6)',
                                marginBottom: 'var(--spacing-6)'
                            }}>
                                <h4 style={{ marginBottom: 'var(--spacing-4)' }}>Socios</h4>
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Nombre</th>
                                                <th>Participación</th>
                                                <th>Documento</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.partners.map(partner => (
                                                <tr key={partner.id}>
                                                    <td>{partner.name}</td>
                                                    <td>{partner.percentage}%</td>
                                                    <td>{partner.document || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Lots Summary */}
                            <div style={{
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--spacing-6)'
                            }}>
                                <h4 style={{ marginBottom: 'var(--spacing-4)' }}>Resumen de Lotes</h4>
                                <div className="grid grid-3" style={{ gap: 'var(--spacing-4)' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--color-primary-400)' }}>
                                            {formData.lots.length}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Total Lotes</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--color-success)' }}>
                                            {formData.lots.reduce((sum, l) => sum + parseFloat(l.area || 0), 0).toLocaleString()} m²
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Área Total</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--color-warning)' }}>
                                            {formatCurrency(formData.lots.reduce((sum, l) => sum + parseFloat(l.price || 0), 0))}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Valor Total</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Navigation */}
                <div className="card-footer">
                    {currentStep > 1 && (
                        <button className="btn btn-secondary" onClick={prevStep}>
                            <FiChevronLeft />
                            Anterior
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    {currentStep < 4 ? (
                        <button className="btn btn-primary" onClick={nextStep}>
                            Siguiente
                            <FiChevronRight />
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleSave}>
                            <FiSave />
                            {isEditing ? 'Actualizar Proyecto' : 'Crear Proyecto'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ProjectWizard;
