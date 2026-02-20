import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    FiSave,
    FiArrowLeft,
    FiDroplet,
    FiZap,
    FiWind
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';

function UtilityForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;

    const { state, addUtilityRegistration, updateUtilityRegistration } = useApp();

    const [formData, setFormData] = useState({
        saleId: '',
        serviceType: 'water',
        amount: '',
        status: 'pending',
        chargeDate: new Date().toISOString().split('T')[0],
        paidDate: '',
        notes: '',
    });

    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    // Load existing data for editing
    useEffect(() => {
        if (isEditing) {
            const existing = (state.utilityRegistrations || []).find(u => u.id === id);
            if (existing) {
                setFormData({
                    saleId: existing.saleId || existing.sale_id || '',
                    serviceType: existing.serviceType || existing.service_type || 'water',
                    amount: existing.amount || '',
                    status: existing.status || 'pending',
                    chargeDate: existing.chargeDate || existing.charge_date || '',
                    paidDate: existing.paidDate || existing.paid_date || '',
                    notes: existing.notes || '',
                });
            }
        }
    }, [id, isEditing, state.utilityRegistrations]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.saleId) newErrors.saleId = 'Selecciona una venta';
        if (!formData.serviceType) newErrors.serviceType = 'Selecciona un tipo de servicio';
        if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = 'Ingresa un monto válido';
        if (!formData.chargeDate) newErrors.chargeDate = 'Ingresa la fecha de cobro';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setSaving(true);
        try {
            if (isEditing) {
                await updateUtilityRegistration({ id, ...formData });
            } else {
                await addUtilityRegistration(formData);
            }
            navigate('/utilities');
        } catch (error) {
            console.error('Error saving utility registration:', error);
        }
        setSaving(false);
    };

    // Build sale options with client and lot info
    const saleOptions = (state.sales || []).map(sale => {
        const client = (state.clients || []).find(c => c.id === (sale.clientId || sale.client_id));
        const project = (state.projects || []).find(p => p.id === (sale.projectId || sale.project_id));
        return {
            id: sale.id,
            label: `${client?.name || client?.fullName || 'Sin cliente'} — Lote #${sale.lotNumber || sale.lot?.number || '?'} (${project?.name || 'Sin proyecto'})`,
        };
    });

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <h1>{isEditing ? 'Editar Matrícula' : 'Nueva Matrícula de Servicio'}</h1>
                    <p>{isEditing ? 'Modifica los datos de la matrícula' : 'Registra el cobro de agua, energía o gas'}</p>
                </div>
                <button className="btn btn-secondary" onClick={() => navigate('/utilities')}>
                    <FiArrowLeft /> Volver
                </button>
            </div>

            {/* Form */}
            <div className="card">
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        {/* Sale Selection */}
                        <div className="form-group">
                            <label className="form-label required">Venta (Cliente / Lote)</label>
                            <select
                                name="saleId"
                                className={`form-control ${errors.saleId ? 'error' : ''}`}
                                value={formData.saleId}
                                onChange={handleChange}
                            >
                                <option value="">Selecciona una venta...</option>
                                {saleOptions.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                                ))}
                            </select>
                            {errors.saleId && <span className="form-error">{errors.saleId}</span>}
                        </div>

                        {/* Service Type */}
                        <div className="form-group">
                            <label className="form-label required">Tipo de Servicio</label>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {[
                                    { value: 'water', label: 'Agua', icon: FiDroplet, color: '#3b82f6' },
                                    { value: 'energy', label: 'Energía', icon: FiZap, color: '#f59e0b' },
                                    { value: 'gas', label: 'Gas', icon: FiWind, color: '#8b5cf6' },
                                ].map(svc => {
                                    const Icon = svc.icon;
                                    const isSelected = formData.serviceType === svc.value;
                                    return (
                                        <button
                                            key={svc.value}
                                            type="button"
                                            onClick={() => handleChange({ target: { name: 'serviceType', value: svc.value } })}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.75rem 1.5rem',
                                                borderRadius: 'var(--radius-lg)',
                                                border: `2px solid ${isSelected ? svc.color : 'var(--border-color)'}`,
                                                background: isSelected ? `${svc.color}15` : 'var(--bg-tertiary)',
                                                color: isSelected ? svc.color : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                fontWeight: isSelected ? 600 : 400,
                                                transition: 'all 0.2s ease',
                                                fontSize: 'var(--font-size-sm)',
                                                fontFamily: 'var(--font-family)',
                                            }}
                                        >
                                            <Icon size={20} />
                                            {svc.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {errors.serviceType && <span className="form-error">{errors.serviceType}</span>}
                        </div>

                        {/* Amount and Date */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label required">Monto</label>
                                <input
                                    type="number"
                                    name="amount"
                                    className={`form-control ${errors.amount ? 'error' : ''}`}
                                    value={formData.amount}
                                    onChange={handleChange}
                                    placeholder="0"
                                    min="0"
                                    step="any"
                                />
                                {errors.amount && <span className="form-error">{errors.amount}</span>}
                            </div>

                            <div className="form-group">
                                <label className="form-label required">Fecha de Cobro</label>
                                <input
                                    type="date"
                                    name="chargeDate"
                                    className={`form-control ${errors.chargeDate ? 'error' : ''}`}
                                    value={formData.chargeDate}
                                    onChange={handleChange}
                                />
                                {errors.chargeDate && <span className="form-error">{errors.chargeDate}</span>}
                            </div>
                        </div>

                        {/* Status and Paid Date */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Estado</label>
                                <select
                                    name="status"
                                    className="form-control"
                                    value={formData.status}
                                    onChange={handleChange}
                                >
                                    <option value="pending">Pendiente</option>
                                    <option value="paid">Pagado</option>
                                </select>
                            </div>

                            {formData.status === 'paid' && (
                                <div className="form-group">
                                    <label className="form-label">Fecha de Pago</label>
                                    <input
                                        type="date"
                                        name="paidDate"
                                        className="form-control"
                                        value={formData.paidDate}
                                        onChange={handleChange}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="form-group">
                            <label className="form-label">Notas</label>
                            <textarea
                                name="notes"
                                className="form-control"
                                value={formData.notes}
                                onChange={handleChange}
                                rows="3"
                                placeholder="Observaciones adicionales..."
                            />
                        </div>

                        {/* Actions */}
                        <div className="card-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => navigate('/utilities')}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                <FiSave /> {saving ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Guardar')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default UtilityForm;
