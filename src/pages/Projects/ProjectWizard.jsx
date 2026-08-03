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
    FiSave,
    FiImage,
    FiLayers,
    FiBox
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/formatters';
import CurrencyInput from '../../components/ui/CurrencyInput';
import { api } from '../../lib/apiClient';
import { resolveImageUrl } from '../../lib/barcodeUtils';


function ProjectWizard() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { addProject, updateProject, getProjectById, generateId } = useApp();
    const { getUsersByRole } = useAuth();
    // Usuarios con rol de socio (disponibles para vincular al proyecto)
    const partnerUsers = getUsersByRole('partner');

    const isEditing = !!id;

    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        description: '',
        logo_url: '',
        partners: [],
        stages: [],
        blocks: [],
        lots: [],
    });

    const [errors, setErrors] = useState({});
    const [bulkConfig, setBulkConfig] = useState({ area: '', price: '' });

    // Builder state for Step 3
    // Each stage: { id, name, useBlocks: bool, lotCount: number (for no-block mode), blocks: [] }
    const [builderStages, setBuilderStages] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    // Load project data if editing
    useEffect(() => {
        if (isEditing) {
            const project = getProjectById(id);
            if (project) {
                setFormData({
                    name: project.name || '',
                    location: project.location || '',
                    description: project.description || '',
                    logo_url: project.logo_url || '',
                    partners: project.partners || [],
                    stages: project.stages || [],
                    blocks: project.blocks || [],
                    lots: project.lots || [],
                });

                // Reconstruct builder tree
                if (project.stages && project.blocks) {
                    const tree = project.stages.map(s => {
                        const sBlocks = project.blocks.filter(b => b.stage_id === s.id).map(b => {
                            const bLotsCount = (project.lots || []).filter(l => l.block_id === b.id).length;
                            return { id: b.id, name: b.name, lotCount: bLotsCount };
                        });
                        const directLots = (project.lots || []).filter(l => l.stage_id === s.id && !l.block_id);
                        return {
                            id: s.id,
                            name: s.name,
                            useBlocks: sBlocks.length > 0,
                            lotCount: directLots.length || (sBlocks.length === 0 ? 1 : 0),
                            blocks: sBlocks
                        };
                    });
                    setBuilderStages(tree);
                }
            } else {
                navigate('/projects');
            }
        }
    }, [id, isEditing]);

    const steps = [
        { number: 1, label: 'Info Básica', icon: FiMapPin },
        { number: 2, label: 'Socios', icon: FiUsers },
        { number: 3, label: 'Estructura', icon: FiLayers },
        { number: 4, label: 'Lotes', icon: FiGrid },
        { number: 5, label: 'Confirmación', icon: FiCheck },
    ];

    // Validate current step
    const validateStep = (step) => {
        const newErrors = {};

        if (step === 1) {
            if (!formData.name.trim()) newErrors.name = 'El nombre es requerido';
            if (!formData.location.trim()) newErrors.location = 'La ubicación es requerida';
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

        if (step === 3) {
            if (builderStages.length === 0) {
                newErrors.structure = 'Debe agregar al menos una etapa';
            } else {
                for (let s of builderStages) {
                    if (!s.name.trim()) {
                        newErrors.structure = 'Todas las etapas deben tener un nombre';
                        break;
                    }
                    if (s.useBlocks) {
                        // Block mode: requires at least one block with name and lots
                        if (s.blocks.length === 0) {
                            newErrors.structure = `La etapa "${s.name}" no tiene manzanas. Agrega al menos una o desactiva el modo manzanas.`;
                            break;
                        }
                        for (let b of s.blocks) {
                            if (!b.name.trim()) {
                                newErrors.structure = 'Todas las manzanas deben tener un nombre';
                                break;
                            }
                            if (b.lotCount < 1) {
                                newErrors.structure = `La manzana "${b.name}" debe tener al menos 1 lote`;
                                break;
                            }
                        }
                    } else {
                        // Direct mode: just needs a lotCount >= 1
                        if (!s.lotCount || parseInt(s.lotCount) < 1) {
                            newErrors.structure = `La etapa "${s.name}" debe tener al menos 1 lote`;
                            break;
                        }
                    }
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle step navigation
    const nextStep = () => {
        if (validateStep(currentStep)) {
            if (currentStep === 3) {
                // Compile flat arrays for stages, blocks, and generate lots
                const flatStages = [];
                const flatBlocks = [];
                let generatedLots = [];
                const existingLots = formData.lots || [];

                builderStages.forEach((s, sIdx) => {
                    const stageId = s.id || generateId();
                    flatStages.push({ id: stageId, name: s.name });

                    if (s.useBlocks) {
                        // Block mode: generate lots per block
                        s.blocks.forEach((b, bIdx) => {
                            const blockId = b.id || generateId();
                            flatBlocks.push({ id: blockId, stage_id: stageId, name: b.name });

                            const stagePrefix = builderStages.length > 1 ? `E${sIdx + 1}-` : '';

                            for (let i = 0; i < b.lotCount; i++) {
                                const lotNumber = `${stagePrefix}${b.name}-${i + 1}`;
                                const existing = existingLots.find(l => l.block_id === blockId && l.number == lotNumber);
                                generatedLots.push(existing || {
                                    id: generateId(),
                                    block_id: blockId,
                                    stage_id: stageId,
                                    number: lotNumber,
                                    manzana: b.name,
                                    etapa_name: s.name,
                                    area: '',
                                    price: '',
                                    status: 'available',
                                });
                            }
                        });
                    } else {
                        // Direct mode: no blocks, generate lots directly under stage
                        const count = parseInt(s.lotCount) || 0;
                        const stagePrefix = builderStages.length > 1 ? `E${sIdx + 1}-` : '';
                        for (let i = 0; i < count; i++) {
                            const lotNumber = `${stagePrefix}${i + 1}`;
                            const existing = existingLots.find(l => l.stage_id === stageId && l.number == lotNumber);
                            generatedLots.push(existing || {
                                id: generateId(),
                                block_id: null,
                                stage_id: stageId,
                                number: lotNumber,
                                manzana: null,
                                etapa_name: s.name,
                                area: '',
                                price: '',
                                status: 'available',
                            });
                        }
                    }
                });

                setFormData(prev => ({
                    ...prev,
                    stages: flatStages,
                    blocks: flatBlocks,
                    lots: generatedLots
                }));
            }
            setCurrentStep(prev => Math.min(prev + 1, 5));
        }
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    // Partner management
    const addPartner = () => {
        setFormData(prev => ({
            ...prev,
            partners: [...prev.partners, { id: generateId(), name: '', percentage: 0, document: '', phone: '', userId: '' }]
        }));
    };
    const updatePartner = (index, field, value) => {
        setFormData(prev => ({
            ...prev, partners: prev.partners.map((p, i) => i === index ? { ...p, [field]: value } : p)
        }));
    };
    const removePartner = (index) => {
        setFormData(prev => ({ ...prev, partners: prev.partners.filter((_, i) => i !== index) }));
    };

    // Builder Management
    const addStage = () => {
        setBuilderStages(prev => [...prev, { id: generateId(), name: '', useBlocks: false, lotCount: 10, blocks: [] }]);
    };
    const updateStage = (sIndex, name) => {
        setBuilderStages(prev => prev.map((s, i) => i === sIndex ? { ...s, name } : s));
    };
    const updateStageLotCount = (sIndex, count) => {
        setBuilderStages(prev => prev.map((s, i) => i === sIndex ? { ...s, lotCount: parseInt(count) || 0 } : s));
    };
    const toggleStageBlocks = (sIndex) => {
        setBuilderStages(prev => prev.map((s, i) => {
            if (i !== sIndex) return s;
            return { ...s, useBlocks: !s.useBlocks };
        }));
    };
    const removeStage = (sIndex) => {
        setBuilderStages(prev => prev.filter((_, i) => i !== sIndex));
    };
    const addBlock = (sIndex) => {
        setBuilderStages(prev => prev.map((s, i) => {
            if (i === sIndex) return { ...s, blocks: [...s.blocks, { id: generateId(), name: '', lotCount: 1 }] };
            return s;
        }));
    };
    const updateBlock = (sIndex, bIndex, field, value) => {
        setBuilderStages(prev => prev.map((s, i) => {
            if (i === sIndex) {
                return {
                    ...s,
                    blocks: s.blocks.map((b, j) => j === bIndex ? { ...b, [field]: value } : b)
                };
            }
            return s;
        }));
    };
    const removeBlock = (sIndex, bIndex) => {
        setBuilderStages(prev => prev.map((s, i) => {
            if (i === sIndex) return { ...s, blocks: s.blocks.filter((_, j) => j !== bIndex) };
            return s;
        }));
    };

    // Lot management
    const updateLot = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            lots: prev.lots.map((l, i) => i === index ? { ...l, [field]: value } : l)
        }));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const { data, error } = await api.upload('endpoints/upload.php', formData);
            
            if (error) {
                alert('Error al subir la imagen: ' + error);
            } else if (data && data.url) {
                setFormData(prev => ({ ...prev, logo_url: data.url }));
            }
        } catch (err) {
            console.error('Upload error:', err);
            alert('Error inesperado al subir la imagen');
        } finally {
            setIsUploading(false);
        }
    };

    // Handle save
    const handleSave = () => {
        // Ítem 23: en modo edición, solo requerimos paso 1 (info básica)
        if (isEditing) {
            if (!validateStep(1)) return;
        } else {
            if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;
        }

        const projectData = {
            name: formData.name,
            location: formData.location,
            description: formData.description,
            logo_url: formData.logo_url,
            partners: formData.partners,
            stages: formData.stages,
            blocks: formData.blocks,
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
                        {idx > 0 && <div className={`stepper-connector ${currentStep > step.number ? 'completed' : ''}`} />}
                        <div className={`stepper-item ${currentStep === step.number ? 'active' : currentStep > step.number ? 'completed' : ''}`}>
                            <div className="stepper-number">{currentStep > step.number ? <FiCheck /> : step.number}</div>
                            <span className="stepper-label">{step.label}</span>
                        </div>
                    </div>
                ))}
            </div>

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
                            <div className="form-group">
                                <label className="form-label">Logo del Proyecto (URL de imagen o Subir desde PC)</label>
                                <div className="flex gap-4">
                                    <div className="flex-1 flex gap-2">
                                        <input
                                            type="url"
                                            className="form-input flex-1"
                                            placeholder="https://ejemplo.com/logo.png"
                                            value={formData.logo_url}
                                            onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                                        />
                                        <label className={`btn btn-secondary ${isUploading ? 'loading' : ''}`} style={{ cursor: 'pointer' }}>
                                            {isUploading ? 'Subiendo...' : <><FiImage /> Subir</>}
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} disabled={isUploading} />
                                        </label>
                                    </div>
                                    {formData.logo_url && (
                                        <div style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                                            <img src={resolveImageUrl(formData.logo_url)} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => e.target.style.display='none'} />
                                        </div>
                                    )}
                                </div>
                                <span className="form-hint">Sube una imagen desde tu PC o pega una URL válida.</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Partners */}
                {currentStep === 2 && (
                    <div className="animate-slideUp">
                        <div className="card-header">
                            <h3 className="card-title"><FiUsers className="card-title-icon" /> Socios del Proyecto</h3>
                            <button className="btn btn-primary btn-sm" onClick={addPartner}><FiPlus /> Agregar Socio</button>
                        </div>
                        <div className="card-body">
                            {errors.partners && <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-error)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)', color: 'var(--color-error)' }}>{errors.partners}</div>}
                            {formData.partners.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--spacing-8)' }}>
                                    <div className="empty-state-icon"><FiUsers /></div>
                                    <h3>Sin socios</h3>
                                    <p>Agrega al menos un socio para continuar</p>
                                    <button className="btn btn-primary btn-sm" onClick={addPartner}><FiPlus /> Agregar Socio</button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {formData.partners.map((partner, index) => (
                                        <div key={partner.id} style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-4)' }}>
                                            <div className="flex-between mb-4">
                                                <h4 style={{ margin: 0 }}>Socio {index + 1}</h4>
                                                <button className="btn btn-ghost btn-sm" onClick={() => removePartner(index)} style={{ color: 'var(--color-error)' }}><FiTrash2 /></button>
                                            </div>
                                            <div className="form-row">
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label">Usuario del Sistema</label>
                                                    {partnerUsers.length > 0 ? (
                                                        <select
                                                            className="form-select"
                                                            value={partner.userId || ''}
                                                            onChange={(e) => {
                                                                const uid = e.target.value;
                                                                const user = partnerUsers.find(u => u.id === uid);
                                                                updatePartner(index, 'userId', uid);
                                                                if (user) updatePartner(index, 'name', user.name || user.email);
                                                            }}
                                                        >
                                                            <option value="">-- Seleccionar usuario socio --</option>
                                                            {partnerUsers.map(u => (
                                                                <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input type="text" className="form-input" placeholder="Nombre del socio" value={partner.name} onChange={(e) => updatePartner(index, 'name', e.target.value)} />
                                                    )}
                                                    {partner.userId && (
                                                        <span className="form-hint" style={{ color: 'var(--color-success)' }}>
                                                            ✔ Vinculado al usuario: {partnerUsers.find(u => u.id === partner.userId)?.email || partner.userId}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label">Nombre visible (editable)</label>
                                                    <input type="text" className="form-input" placeholder="Nombre del socio" value={partner.name} onChange={(e) => updatePartner(index, 'name', e.target.value)} />
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label">% Participación</label>
                                                    <input type="number" className="form-input" min="0" max="100" step="0.1" placeholder="25" value={partner.percentage} onChange={(e) => updatePartner(index, 'percentage', parseFloat(e.target.value) || 0)} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex-between" style={{ background: 'var(--bg-secondary)', padding: 'var(--spacing-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                                        <span>Total Participación:</span>
                                        <span style={{ fontWeight: '700', color: Math.abs(formData.partners.reduce((sum, p) => sum + parseFloat(p.percentage || 0), 0) - 100) < 0.01 ? 'var(--color-success)' : 'var(--color-error)' }}>
                                            {formData.partners.reduce((sum, p) => sum + parseFloat(p.percentage || 0), 0).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 3: Structure Builder */}
                {currentStep === 3 && (
                    <div className="animate-slideUp">
                        <div className="card-header">
                            <h3 className="card-title"><FiLayers className="card-title-icon" /> Estructura del Proyecto</h3>
                            <button className="btn btn-primary btn-sm" onClick={addStage}><FiPlus /> Agregar Etapa</button>
                        </div>
                        <div className="card-body">
                            {errors.structure && <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-error)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)', color: 'var(--color-error)' }}>{errors.structure}</div>}
                            <p className="text-muted" style={{ marginBottom: 'var(--spacing-6)' }}>Crea las etapas y manzanas de tu proyecto. El sistema auto-generará los lotes en el siguiente paso en base a esta configuración.</p>
                            
                            {builderStages.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon"><FiLayers /></div>
                                    <h3>Sin estructura</h3>
                                    <p>Empieza agregando tu primera Etapa</p>
                                    <button className="btn btn-primary btn-sm mt-4" onClick={addStage}><FiPlus /> Agregar Etapa</button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-6">
                                    {builderStages.map((stage, sIdx) => (
                                        <div key={stage.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-5)', background: 'var(--bg-tertiary)' }}>
                                            <div className="flex-between mb-4" style={{ alignItems: 'flex-end' }}>
                                                <div className="form-group" style={{ marginBottom: 0, flex: 1, marginRight: '1rem' }}>
                                                    <label className="form-label text-primary" style={{ fontWeight: 600 }}>Nombre de la Etapa</label>
                                                    <input type="text" className="form-input" style={{ fontSize: '1.1rem' }} placeholder="Ej: Etapa 1" value={stage.name} onChange={(e) => updateStage(sIdx, e.target.value)} />
                                                </div>
                                                <button className="btn btn-danger btn-sm" onClick={() => removeStage(sIdx)}><FiTrash2 /></button>
                                            </div>

                                            {/* Toggle: use blocks or not */}
                                            <div style={{ marginBottom: 'var(--spacing-4)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', background: 'var(--bg-secondary)', padding: 'var(--spacing-3)', borderRadius: 'var(--radius-md)' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                                                    Organización:
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleStageBlocks(sIdx)}
                                                    className={`btn btn-sm ${!stage.useBlocks ? 'btn-primary' : 'btn-secondary'}`}
                                                    style={{ gap: '6px' }}
                                                >
                                                    🔢 Solo Lotes (sin manzana)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleStageBlocks(sIdx)}
                                                    className={`btn btn-sm ${stage.useBlocks ? 'btn-primary' : 'btn-secondary'}`}
                                                    style={{ gap: '6px' }}
                                                >
                                                    <FiBox /> Con Manzanas
                                                </button>
                                            </div>

                                            {!stage.useBlocks ? (
                                                /* Direct lot count mode */
                                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-3)' }}>
                                                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                                        <label className="form-label">Cantidad de Lotes en la Etapa</label>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            min="1"
                                                            max="1000"
                                                            placeholder="Ej: 50"
                                                            value={stage.lotCount || ''}
                                                            onChange={(e) => updateStageLotCount(sIdx, e.target.value)}
                                                            disabled={isEditing}
                                                        />
                                                        <span className="form-hint">
                                                            Se generarán lotes numerados: {builderStages.length > 1 ? `E${sIdx+1}-1, E${sIdx+1}-2...` : '1, 2, 3...'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Block (manzana) mode */
                                                <div style={{ paddingLeft: '1rem', borderLeft: '2px solid var(--border-color)', marginTop: '1rem' }}>
                                                    <div className="flex-between mb-3">
                                                        <h4 style={{ margin: 0, color: 'var(--text-muted)' }}><FiBox /> Manzanas</h4>
                                                        <button className="btn btn-secondary btn-sm" onClick={() => addBlock(sIdx)}><FiPlus /> Agregar Manzana</button>
                                                    </div>

                                                    {stage.blocks.length === 0 ? (
                                                        <p className="text-muted" style={{ fontStyle: 'italic', fontSize: '0.9rem' }}>No hay manzanas en esta etapa.</p>
                                                    ) : (
                                                        <div className="flex flex-col gap-3">
                                                            {stage.blocks.map((block, bIdx) => (
                                                                <div key={block.id} className="flex gap-3" style={{ alignItems: 'flex-end', background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                                                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                                                        <label className="form-label" style={{ fontSize: '0.85rem' }}>Nombre Manzana</label>
                                                                        <input type="text" className="form-input" placeholder="Ej: A" value={block.name} onChange={(e) => updateBlock(sIdx, bIdx, 'name', e.target.value)} />
                                                                    </div>
                                                                    <div className="form-group" style={{ marginBottom: 0, width: '150px' }}>
                                                                        <label className="form-label" style={{ fontSize: '0.85rem' }}>Cant. Lotes</label>
                                                                        <input type="number" className="form-input" min="1" value={block.lotCount} onChange={(e) => updateBlock(sIdx, bIdx, 'lotCount', parseInt(e.target.value) || 1)} disabled={isEditing} />
                                                                    </div>
                                                                    <button className="btn btn-ghost" onClick={() => removeBlock(sIdx, bIdx)} style={{ color: 'var(--color-error)', padding: '0.5rem' }}><FiTrash2 /></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 4: Lots Validation */}
                {currentStep === 4 && (
                    <div className="animate-slideUp">
                        <div className="card-header">
                            <h3 className="card-title"><FiGrid className="card-title-icon" /> Configuración de Lotes</h3>
                        </div>
                        <div className="card-body">
                            {/* Ítem 17: Botón Siguiente también en la parte superior del paso de lotes */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-4)' }}>
                                <button className="btn btn-primary btn-sm" onClick={nextStep}>
                                    Continuar al siguiente paso <FiChevronRight />
                                </button>
                            </div>
                            <div style={{ background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(139, 195, 74, 0.05))', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-5)', marginBottom: 'var(--spacing-6)' }}>
                                <h4 style={{ marginBottom: 'var(--spacing-4)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}><FiGrid /> Configuración Masiva</h4>
                                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-4)' }}>Aplica el mismo área y precio a todos los lotes disponibles</p>
                                <div className="form-row" style={{ alignItems: 'flex-end' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Área (m²)</label>
                                        <input type="number" className="form-input" placeholder="Ej: 120" value={bulkConfig.area} onChange={(e) => setBulkConfig(prev => ({ ...prev, area: e.target.value }))} min="0" />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Precio ($)</label>
                                        <CurrencyInput className="form-input" placeholder="Ej: 50000000" value={bulkConfig.price} onChange={(e) => setBulkConfig(prev => ({ ...prev, price: e.target.value }))} />
                                    </div>
                                    <button type="button" className="btn btn-primary" onClick={() => {
                                        const bulkArea = bulkConfig.area; const bulkPrice = bulkConfig.price;
                                        if (bulkArea || bulkPrice) {
                                            setFormData(prev => ({
                                                ...prev,
                                                lots: prev.lots.map(lot => {
                                                    if (lot.status === 'sold') return lot;
                                                    return { ...lot, area: bulkArea || lot.area, price: bulkPrice || lot.price };
                                                })
                                            }));
                                        }
                                    }}>Aplicar a Todos</button>
                                </div>

                                {/* CSV Import/Export */}
                                <div style={{ marginTop: 'var(--spacing-4)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 'var(--spacing-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Carga desde archivo:</span>
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => {
                                        // Generate CSV template from lots
                                        const header = 'Lote,Etapa,Manzana,Area_m2,Precio';
                                        const rows = formData.lots.map(lot => {
                                            const stageName = lot.etapa_name || builderStages.find(s => s.blocks.some(b => b.id === lot.block_id))?.name || '';
                                            const blockName = lot.manzana || builderStages.flatMap(s => s.blocks).find(b => b.id === lot.block_id)?.name || '';
                                            return `${lot.number},${stageName},${blockName},${lot.area || ''},${lot.price || ''}`;
                                        });
                                        const csv = '\uFEFF' + [header, ...rows].join('\n');
                                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `lotes_${formData.name || 'proyecto'}.csv`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }}>⬇ Descargar Plantilla CSV</button>
                                    <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                                        ⬆ Importar CSV
                                        <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = (evt) => {
                                                try {
                                                    const text = evt.target.result;
                                                    const lines = text.split(/\r?\n/).filter(l => l.trim());
                                                    if (lines.length < 2) { alert('CSV vacío o sin datos'); return; }
                                                    // Skip header
                                                    const dataRows = lines.slice(1);
                                                    let updated = 0;
                                                    setFormData(prev => {
                                                        const newLots = [...prev.lots];
                                                        dataRows.forEach(row => {
                                                            const cols = row.split(',').map(c => c.trim());
                                                            if (cols.length < 5) return;
                                                            const [lotNum, , , area, price] = cols;
                                                            const lotIdx = newLots.findIndex(l => String(l.number) === String(lotNum));
                                                            if (lotIdx >= 0 && newLots[lotIdx].status !== 'sold') {
                                                                if (area) newLots[lotIdx] = { ...newLots[lotIdx], area };
                                                                if (price) newLots[lotIdx] = { ...newLots[lotIdx], price: price.replace(/[^0-9.]/g, '') };
                                                                updated++;
                                                            }
                                                        });
                                                        return { ...prev, lots: newLots };
                                                    });
                                                    setTimeout(() => alert(`✅ ${updated} lotes actualizados desde CSV`), 100);
                                                } catch (err) {
                                                    alert('Error al leer CSV: ' + err.message);
                                                }
                                            };
                                            reader.readAsText(file);
                                            e.target.value = '';
                                        }} />
                                    </label>
                                </div>
                            </div>

                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Etapa</th>
                                            <th>Manzana</th>
                                            <th>Lote #</th>
                                            <th>Área (m²)</th>
                                            <th>Precio</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.lots.map((lot, index) => {
                                            const stageName = lot.etapa_name || builderStages.find(s => s.blocks.some(b => b.id === lot.block_id))?.name || '-';
                                            const blockName = lot.manzana || builderStages.flatMap(s => s.blocks).find(b => b.id === lot.block_id)?.name || '-';
                                            return (
                                                <tr key={lot.id}>
                                                    <td><span className="badge" style={{ background: 'var(--bg-tertiary)' }}>{stageName}</span></td>
                                                    <td><span className="badge" style={{ background: 'var(--bg-tertiary)' }}>{blockName}</span></td>
                                                    <td>
                                                        <input type="text" className="form-input" value={lot.number} onChange={(e) => updateLot(index, 'number', e.target.value)} disabled={lot.status === 'sold'} style={{ width: '80px', fontWeight: 600 }} />
                                                    </td>
                                                    <td>
                                                        <input type="number" className="form-input" style={{ width: '120px' }} value={lot.area} onChange={(e) => updateLot(index, 'area', e.target.value)} disabled={lot.status === 'sold'} />
                                                    </td>
                                                    <td>
                                                        <CurrencyInput className="form-input" style={{ width: '180px' }} value={lot.price} onChange={(e) => updateLot(index, 'price', e.target.value)} disabled={lot.status === 'sold'} />
                                                    </td>
                                                    <td><span className={`badge ${lot.status === 'sold' ? 'badge-success' : 'badge-info'}`}>{lot.status === 'sold' ? 'Vendido' : 'Disponible'}</span></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 5: Confirmation */}
                {currentStep === 5 && (
                    <div className="animate-slideUp">
                        <div className="card-header"><h3 className="card-title"><FiCheck className="card-title-icon" /> Confirmar Proyecto</h3></div>
                        <div className="card-body">
                            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-6)', marginBottom: 'var(--spacing-6)' }}>
                                <h4 style={{ marginBottom: 'var(--spacing-4)' }}>Información del Proyecto</h4>
                                <div className="grid grid-2" style={{ gap: 'var(--spacing-4)' }}>
                                    <div><span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Nombre:</span><p style={{ margin: 0, fontWeight: '500' }}>{formData.name}</p></div>
                                    <div><span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Ubicación:</span><p style={{ margin: 0, fontWeight: '500' }}>{formData.location}</p></div>
                                    <div><span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Etapas:</span><p style={{ margin: 0, fontWeight: '500' }}>{formData.stages.length}</p></div>
                                    <div><span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Manzanas:</span><p style={{ margin: 0, fontWeight: '500' }}>{formData.blocks.length}</p></div>
                                </div>
                            </div>
                            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-6)' }}>
                                <h4 style={{ marginBottom: 'var(--spacing-4)' }}>Resumen de Lotes</h4>
                                <div className="grid grid-3" style={{ gap: 'var(--spacing-4)' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--color-primary-400)' }}>{formData.lots.length}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Total Lotes</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--color-success)' }}>{formData.lots.reduce((sum, l) => sum + parseFloat(l.area || 0), 0).toLocaleString()} m²</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Área Total</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--color-warning)' }}>{formatCurrency(formData.lots.reduce((sum, l) => sum + parseFloat(l.price || 0), 0))}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Valor Total</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="card-footer">
                    {currentStep > 1 && <button className="btn btn-secondary" onClick={prevStep}><FiChevronLeft /> Anterior</button>}
                    <div style={{ flex: 1 }} />
                    {/* Ítem 23: en modo edición mostrar botón guardar en todos los pasos */}
                    {isEditing && currentStep < 5 && (
                        <button className="btn btn-secondary" onClick={handleSave}>
                            <FiSave /> Guardar cambios
                        </button>
                    )}
                    {currentStep < 5 ? (
                        <button className="btn btn-primary" onClick={nextStep}>Siguiente <FiChevronRight /></button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleSave}><FiSave /> {isEditing ? 'Actualizar Proyecto' : 'Crear Proyecto'}</button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ProjectWizard;
