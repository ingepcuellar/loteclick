import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    FiArrowLeft,
    FiSave,
    FiDollarSign,
    FiUser,
    FiFolder,
    FiCalendar,
    FiFileText,
    FiUpload,
    FiEdit3,
    FiTrash2,
    FiImage
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { disbursementService } from '../../services/disbursementService';
import { storageService } from '../../services/storageService';
import { formatCurrency, todayBogota } from '../../lib/formatters';
import { pickImage } from '../../lib/cameraUtils';
import CurrencyInput from '../../components/ui/CurrencyInput';

function DisbursementForm() {
    const navigate = useNavigate();
    const { state } = useApp();
    const projects = state.projects || [];
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    const [formData, setFormData] = useState({
        projectId: '',
        partnerId: '',
        amount: '',
        disbursementDate: todayBogota(),
        notes: '',
        paymentMethod: 'cash',
    });

    const [partners, setPartners] = useState([]);
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptPreview, setReceiptPreview] = useState(null);
    const [useSignature, setUseSignature] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    // Ítem 4a: Calcular distribución sugerida basada en porcentaje del socio
    const [suggestedAmount, setSuggestedAmount] = useState(null);

    const calculateSuggested = (projectId, partnerId) => {
        if (!projectId || !partnerId) { setSuggestedAmount(null); return; }
        const project = projects.find(p => p.id === projectId);
        const partner = project?.partners?.find(p => p.id === partnerId);
        if (!partner || !project) { setSuggestedAmount(null); return; }

        // Ingresos del proyecto (pagos de todas sus ventas)
        const projectSales = (state.sales || []).filter(s => s.projectId === projectId);
        const projectIncome = (state.payments || []).filter(p => {
            const sale = projectSales.find(s => s.id === (p.saleId || p.sale_id));
            return !!sale;
        }).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        // Gastos del proyecto
        const projectExpenses = (state.expenses || []).filter(
            e => (e.projectId || e.project_id) === projectId
        ).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        const netBase = Math.max(0, projectIncome - projectExpenses);
        const suggested = Math.round((netBase * partner.percentage / 100) / 1000) * 1000;
        setSuggestedAmount({ amount: suggested, percentage: partner.percentage, netBase, projectIncome, projectExpenses });
    };

    // Load partners for selected project
    useEffect(() => {
        if (formData.projectId) {
            const project = projects.find(p => p.id === formData.projectId);
            setPartners(project?.partners || []);
            setFormData(prev => ({ ...prev, partnerId: '' }));
            setSuggestedAmount(null); // Ítem 4a
        } else {
            setPartners([]);
        }
    }, [formData.projectId, projects]);

    // Setup canvas for signature
    useEffect(() => {
        if (useSignature && canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = canvas.offsetWidth;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#1a1a2e';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    }, [useSignature]);

    const getCanvasCoords = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        const { x, y } = getCanvasCoords(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setHasSignature(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const { x, y } = getCanvasCoords(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    };

    const handlePickImage = async () => {
        const result = await pickImage();
        if (result) {
            setReceiptFile(result.file);
            setReceiptPreview(result.preview);
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.projectId) newErrors.projectId = 'Seleccione un proyecto';
        if (!formData.partnerId) newErrors.partnerId = 'Seleccione un socio';
        if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = 'Ingrese un monto válido';
        if (!formData.disbursementDate) newErrors.disbursementDate = 'Seleccione una fecha';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setSaving(true);
        try {
            let receiptImageUrl = null;
            let signatureImageUrl = null;

            // Upload receipt image
            if (receiptFile) {
                const { data: uploadData } = await storageService.uploadFile(receiptFile, 'disbursements');
                if (uploadData) receiptImageUrl = uploadData.url || uploadData;
            }

            // Upload signature from canvas
            if (useSignature && hasSignature && canvasRef.current) {
                const signatureBlob = await new Promise(resolve => {
                    canvasRef.current.toBlob(resolve, 'image/png');
                });
                if (signatureBlob) {
                    const signatureFile = new File([signatureBlob], 'firma.png', { type: 'image/png' });
                    const { data: uploadData } = await storageService.uploadFile(signatureFile, 'signatures');
                    if (uploadData) signatureImageUrl = uploadData.url || uploadData;
                }
            }

            const disbursementData = {
                project_id: formData.projectId,
                partner_id: formData.partnerId,
                amount: parseFloat(formData.amount),
                disbursement_date: formData.disbursementDate,
                payment_method: formData.paymentMethod,
                receipt_image: receiptImageUrl,
                signature_image: signatureImageUrl,
                notes: formData.notes,
            };

            const { error } = await disbursementService.create(disbursementData);
            if (error) {
                alert('Error al guardar: ' + error);
            } else {
                navigate('/disbursements');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };



    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <Link to="/disbursements" className="btn btn-ghost" style={{ marginBottom: '0.5rem' }}>
                        <FiArrowLeft /> Volver
                    </Link>
                    <h1><FiDollarSign /> Nueva Entrega a Socio</h1>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="form-card">
                {/* Project */}
                <div className="form-group">
                    <label className="form-label">
                        <FiFolder /> Proyecto *
                    </label>
                    <select
                        value={formData.projectId}
                        onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
                        className={`form-control ${errors.projectId ? 'error' : ''}`}
                    >
                        <option value="">Seleccionar proyecto...</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    {errors.projectId && <span className="form-error">{errors.projectId}</span>}
                </div>

                {/* Partner */}
                <div className="form-group">
                    <label className="form-label">
                        <FiUser /> Socio *
                    </label>
                    <select
                        value={formData.partnerId}
                        onChange={(e) => {
                            setFormData(prev => ({ ...prev, partnerId: e.target.value }));
                            calculateSuggested(formData.projectId, e.target.value); // Ítem 4a
                        }}
                        className={`form-control ${errors.partnerId ? 'error' : ''}`}
                        disabled={!formData.projectId}
                    >
                        <option value="">Seleccionar socio...</option>
                        {partners.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.percentage}%)</option>
                        ))}
                    </select>
                    {errors.partnerId && <span className="form-error">{errors.partnerId}</span>}
                </div>

                {/* Amount */}
                <div className="form-group">
                    <label className="form-label">
                        <FiDollarSign /> Monto *
                    </label>
                    <CurrencyInput
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        className={`form-control ${errors.amount ? 'error' : ''}`}
                        placeholder="0"
                    />
                    {formData.amount && (
                        <small style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            {formatCurrency(formData.amount)}
                        </small>
                    )}
                    {errors.amount && <span className="form-error">{errors.amount}</span>}

                    {/* Ítem 4a: Distribución sugerida */}
                    {suggestedAmount && (
                        <div style={{
                            marginTop: '0.5rem', padding: '0.75rem 1rem',
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.05))',
                            border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--color-success)', marginBottom: '2px' }}>
                                        💡 Distribución sugerida: {formatCurrency(suggestedAmount.amount)}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                        {suggestedAmount.percentage}% de utilidad neta {formatCurrency(suggestedAmount.netBase)}
                                        {' '}(Ingresos: {formatCurrency(suggestedAmount.projectIncome)} − Gastos: {formatCurrency(suggestedAmount.projectExpenses)})
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => setFormData(prev => ({ ...prev, amount: String(suggestedAmount.amount) }))}
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    Usar sugerido
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Date */}
                <div className="form-group">
                    <label className="form-label">
                        <FiCalendar /> Fecha *
                    </label>
                    <input
                        type="date"
                        value={formData.disbursementDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, disbursementDate: e.target.value }))}
                        className={`form-control ${errors.disbursementDate ? 'error' : ''}`}
                    />
                    {errors.disbursementDate && <span className="form-error">{errors.disbursementDate}</span>}
                </div>

                {/* Modalidad de Pago */}
                <div className="form-group">
                    <label className="form-label">
                        <FiDollarSign /> Modalidad de Pago
                    </label>
                    <select
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                        className="form-select"
                    >
                        <option value="cash">💵 Efectivo</option>
                        <option value="transfer">🏦 Transferencia Bancaria</option>
                        <option value="check">📋 Cheque</option>
                    </select>
                </div>

                {/* Notes */}
                <div className="form-group">
                    <label className="form-label">
                        <FiFileText /> Notas
                    </label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        className="form-control"
                        rows="3"
                        placeholder="Notas adicionales..."
                    />
                </div>


                {/* Evidence: Signature or Receipt */}
                <div className="form-group">
                    <label className="form-label">
                        <FiEdit3 /> Comprobante
                    </label>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <button
                            type="button"
                            className={`btn ${useSignature ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setUseSignature(true)}
                        >
                            <FiEdit3 /> Firma Digital
                        </button>
                        <button
                            type="button"
                            className={`btn ${!useSignature ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setUseSignature(false)}
                        >
                            <FiUpload /> Subir Recibo
                        </button>
                    </div>

                    {useSignature ? (
                        <div>
                            <div style={{
                                border: '2px dashed var(--border)',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                marginBottom: '0.5rem',
                                backgroundColor: '#fff',
                                touchAction: 'none'
                            }}>
                                <canvas
                                    ref={canvasRef}
                                    style={{ width: '100%', height: '200px', cursor: 'crosshair', display: 'block' }}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                />
                            </div>
                            <button type="button" className="btn btn-sm btn-outline" onClick={clearSignature}>
                                <FiTrash2 /> Limpiar Firma
                            </button>
                        </div>
                    ) : (
                        <div>
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={handlePickImage}
                                style={{ width: '100%', padding: '1rem' }}
                            >
                                <FiUpload /> Tomar foto o seleccionar imagen
                            </button>
                            {receiptPreview && (
                                <div style={{ marginTop: '1rem' }}>
                                    <img
                                        src={receiptPreview}
                                        alt="Recibo"
                                        style={{ maxWidth: '300px', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Submit */}
                <div className="form-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                    <Link to="/disbursements" className="btn btn-ghost">
                        Cancelar
                    </Link>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        <FiSave /> {saving ? 'Guardando...' : 'Registrar Entrega'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default DisbursementForm;
