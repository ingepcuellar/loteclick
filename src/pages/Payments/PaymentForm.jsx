import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
    FiArrowLeft,
    FiSave,
    FiDollarSign,
    FiCalendar,
    FiUpload,
    FiX,
    FiImage,
    FiLoader,
    FiCheck,
    FiSearch
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../lib/formatters';
import { storageService } from '../../services/storageService';
import { parseBarcodeInput, generatePaymentReceiptHTML, openPrintWindow, writeToPrintWindow } from '../../lib/barcodeUtils';

function PaymentForm() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preselectedSaleId = searchParams.get('saleId');

    const {
        state,
        addPayment,
        getSaleById,
        getClientById,
        getProjectById,
        getPendingAmount,
        getPendingInstallmentsBySale,
        markInstallmentAsPaid,
        autoRedistributeInstallments
    } = useApp();

    const [formData, setFormData] = useState({
        saleId: preselectedSaleId || '',
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
        receiptImage: '',
        notes: '',
    });

    const [errors, setErrors] = useState({});
    const [previewImage, setPreviewImage] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [pendingInstallments, setPendingInstallments] = useState([]);
    const [selectedInstallmentId, setSelectedInstallmentId] = useState('');
    const [loadingInstallments, setLoadingInstallments] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Barcode scanning
    const [barcodeInput, setBarcodeInput] = useState('');
    const [barcodeError, setBarcodeError] = useState('');
    const barcodeInputRef = useRef(null);



    // Handle barcode scan input (barcode scanners act as keyboard + Enter)
    const handleBarcodeKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const prefix = parseBarcodeInput(barcodeInput);
            if (!prefix) {
                setBarcodeError('Código no válido. Formato esperado: LCK-XXXXXXXX');
                return;
            }
            setBarcodeError('');
            // Find sale whose ID starts with this prefix (case-insensitive)
            const matchedSale = state.sales.find(s =>
                s.id && s.id.toUpperCase().startsWith(prefix)
            );
            if (matchedSale) {
                const pending = getPendingAmount(matchedSale.id);
                if (pending <= 0) {
                    setBarcodeError('Esta venta ya está completamente pagada.');
                    return;
                }
                setFormData(prev => ({ ...prev, saleId: matchedSale.id, amount: '' }));
                setBarcodeInput('');
            } else {
                setBarcodeError('No se encontró ninguna venta con este código.');
            }
        }
    };

    // Get sales with pending amounts
    const salesWithPending = state.sales.map(sale => {
        const pending = getPendingAmount(sale.id);
        const client = getClientById(sale.clientId);
        const project = getProjectById(sale.projectId);
        return { ...sale, pending, client, project };
    }).filter(sale => sale.pending > 0);

    const selectedSale = formData.saleId ? getSaleById(formData.saleId) : null;
    const pendingAmount = selectedSale ? getPendingAmount(formData.saleId) : 0;
    const isInstallmentSale = selectedSale && (selectedSale.paymentType === 'installments' || selectedSale.paymentType === 'credit' || selectedSale.payment_type === 'credit');

    // Load installments when sale changes
    useEffect(() => {
        const loadInstallments = async () => {
            if (formData.saleId && isInstallmentSale) {
                setLoadingInstallments(true);
                try {
                    const { data, error } = await getPendingInstallmentsBySale(formData.saleId);
                    if (!error && data) {
                        // Normalize installment data
                        const normalized = data.map(inst => ({
                            ...inst,
                            installmentNumber: inst.installment_number || inst.installmentNumber,
                            dueDate: inst.due_date || inst.dueDate,
                            paidAmount: inst.paid_amount || inst.paidAmount || 0
                        }));
                        setPendingInstallments(normalized);
                    }
                } catch (err) {
                    console.error('Error loading installments:', err);
                } finally {
                    setLoadingInstallments(false);
                }
            } else {
                setPendingInstallments([]);
            }
            setSelectedInstallmentId('');
        };
        loadInstallments();
    }, [formData.saleId, isInstallmentSale]);

    // Update amount when installment is selected
    const handleInstallmentChange = (installmentId) => {
        setSelectedInstallmentId(installmentId);
        if (installmentId) {
            const inst = pendingInstallments.find(i => i.id === installmentId);
            if (inst) {
                setFormData(prev => ({ ...prev, amount: inst.amount.toString() }));
            }
        } else {
            setFormData(prev => ({ ...prev, amount: '' }));
        }
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.saleId) newErrors.saleId = 'Selecciona una venta';
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            newErrors.amount = 'El monto debe ser mayor a 0';
        }
        if (parseFloat(formData.amount) > pendingAmount) {
            newErrors.amount = `El monto no puede ser mayor al pendiente (${formatCurrency(pendingAmount)})`;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('La imagen no puede ser mayor a 5MB');
                return;
            }

            // Show preview immediately
            const reader = new FileReader();
            reader.onload = (event) => {
                setPreviewImage(event.target.result);
            };
            reader.readAsDataURL(file);

            // Upload to server
            setUploadingImage(true);
            try {
                const { data: uploadData, error } = await storageService.uploadFile(file);
                const url = uploadData?.url;
                if (error) {
                    console.error('Error uploading image:', error);
                    alert('Error al subir la imagen. Se guardará localmente.');
                    // Fallback to base64
                    const reader2 = new FileReader();
                    reader2.onload = (event) => {
                        setFormData(prev => ({ ...prev, receiptImage: event.target.result }));
                    };
                    reader2.readAsDataURL(file);
                } else {
                    setFormData(prev => ({ ...prev, receiptImage: url }));
                }
            } catch (err) {
                console.error('Error uploading:', err);
                // Fallback to base64
                const reader2 = new FileReader();
                reader2.onload = (event) => {
                    setFormData(prev => ({ ...prev, receiptImage: event.target.result }));
                };
                reader2.readAsDataURL(file);
            } finally {
                setUploadingImage(false);
            }
        }
    };

    const removeImage = () => {
        setPreviewImage(null);
        setFormData(prev => ({ ...prev, receiptImage: '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) return;

        // Open print window NOW (synchronous, during user click) to avoid popup blocker
        const receiptWindow = openPrintWindow();

        setIsProcessing(true);

        try {
            const paymentAmount = parseFloat(formData.amount);

            // 1. Register the payment
            const paymentData = {
                saleId: formData.saleId,
                amount: paymentAmount,
                paymentDate: formData.paymentDate,
                receiptImage: formData.receiptImage,
                notes: formData.notes,
            };

            const payment = await addPayment(paymentData);

            // 2. Handle installment logic
            if (isInstallmentSale && pendingInstallments.length > 0 && payment && payment.id) {
                const firstInstallmentAmount = parseFloat(pendingInstallments[0]?.amount || 0);

                if (Math.abs(paymentAmount - firstInstallmentAmount) > 0.01) {
                    // Amount differs from installment — auto redistribute
                    try {
                        await autoRedistributeInstallments(
                            formData.saleId,
                            paymentAmount,
                            payment.id
                        );
                    } catch (err) {
                        console.error('Error auto-redistributing installments:', err);
                    }
                } else {
                    // Exact payment — just mark installment as paid
                    if (selectedInstallmentId) {
                        try {
                            await markInstallmentAsPaid(selectedInstallmentId, payment.id);
                        } catch (err) {
                            console.error('Error marking installment as paid:', err);
                        }
                    }
                }
            }

            // Auto-print payment receipt to pre-opened window
            try {
                const client = getClientById(selectedSale?.clientId);
                const project = getProjectById(selectedSale?.projectId);
                const totalPaid = state.payments
                    .filter(p => (p.saleId || p.sale_id) === formData.saleId)
                    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

                const receiptHtml = generatePaymentReceiptHTML({
                    payment: {
                        id: payment.id,
                        amount: paymentAmount,
                        paymentDate: formData.paymentDate,
                        notes: formData.notes
                    },
                    sale: { ...selectedSale, totalPaid },
                    client,
                    project
                });
                writeToPrintWindow(receiptWindow, receiptHtml);
            } catch (err) {
                console.error('Error generating payment receipt:', err);
                if (receiptWindow && !receiptWindow.closed) receiptWindow.close();
            }

            navigateAfterPayment();
        } catch (err) {
            console.error('Error processing payment:', err);
            alert('Error al procesar el pago. Intente de nuevo.');
            if (receiptWindow && !receiptWindow.closed) receiptWindow.close();
        } finally {
            setIsProcessing(false);
        }
    };

    const navigateAfterPayment = () => {
        if (preselectedSaleId) {
            navigate(`/sales/${preselectedSaleId}`);
        } else {
            navigate('/payments');
        }
    };

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <Link to={preselectedSaleId ? `/sales/${preselectedSaleId}` : '/payments'} className="btn btn-ghost btn-sm mb-2">
                        <FiArrowLeft /> Volver
                    </Link>
                    <h1>Registrar Pago</h1>
                    <p>Registra un nuevo pago de una venta</p>
                </div>
            </div>

            {/* Barcode Scanner Section */}
            {!preselectedSaleId && (
                <div className="card mb-6" style={{ borderLeft: '4px solid var(--color-primary-500)' }}>
                    <div className="card-body">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
                            <FiSearch style={{ fontSize: '20px', color: 'var(--color-primary-500)' }} />
                            <div>
                                <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>Escanear Código de Barras</h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Escanee o escriba el código del recibo de venta</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
                            <input
                                ref={barcodeInputRef}
                                type="text"
                                className="form-input"
                                placeholder="LCK-XXXXXXXX"
                                value={barcodeInput}
                                onChange={(e) => { setBarcodeInput(e.target.value.toUpperCase()); setBarcodeError(''); }}
                                onKeyDown={handleBarcodeKeyDown}
                                autoFocus
                                style={{ flex: 1, fontFamily: 'monospace', fontSize: '16px', letterSpacing: '2px' }}
                            />
                        </div>
                        {barcodeError && (
                            <div style={{ marginTop: 'var(--spacing-2)', color: 'var(--color-error)', fontSize: 'var(--font-size-sm)' }}>
                                {barcodeError}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="grid grid-2">
                    {/* Payment Details */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">
                                <FiDollarSign className="card-title-icon" />
                                Detalles del Pago
                            </h3>
                        </div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label required">Seleccionar Venta</label>
                                <select
                                    className={`form-select ${errors.saleId ? 'error' : ''}`}
                                    value={formData.saleId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, saleId: e.target.value, amount: '' }))}
                                    disabled={!!preselectedSaleId}
                                >
                                    <option value="">Selecciona una venta</option>
                                    {salesWithPending.map(sale => (
                                        <option key={sale.id} value={sale.id}>
                                            {sale.client?.name || sale.client?.fullName} - {sale.project?.name} Lote {sale.lotNumber}
                                            (Pendiente: {formatCurrency(sale.pending)})
                                        </option>
                                    ))}
                                </select>
                                {errors.saleId && <span className="form-error">{errors.saleId}</span>}
                            </div>

                            {selectedSale && (
                                <div style={{
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 'var(--spacing-4)',
                                    marginBottom: 'var(--spacing-4)'
                                }}>
                                    <div className="flex-between mb-2">
                                        <span style={{ color: 'var(--text-muted)' }}>Precio Total:</span>
                                        <span style={{ fontWeight: '500' }}>{formatCurrency(selectedSale.totalPrice)}</span>
                                    </div>
                                    <div className="flex-between">
                                        <span style={{ color: 'var(--text-muted)' }}>Pendiente:</span>
                                        <span style={{ fontWeight: '600', color: 'var(--color-warning)' }}>
                                            {formatCurrency(pendingAmount)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Installments Section */}
                            {isInstallmentSale && selectedSale && (
                                <div className="form-group">
                                    <label className="form-label">
                                        <FiCalendar style={{ marginRight: '4px' }} />
                                        Cuota a Pagar
                                    </label>
                                    {loadingInstallments ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: 'var(--spacing-3)' }}>
                                            <FiLoader style={{ animation: 'spin 1s linear infinite' }} />
                                            <span style={{ color: 'var(--text-muted)' }}>Cargando cuotas...</span>
                                        </div>
                                    ) : pendingInstallments.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)', margin: 0, padding: 'var(--spacing-2)' }}>
                                            No hay cuotas pendientes. Todas las cuotas han sido pagadas.
                                        </p>
                                    ) : (
                                        <>
                                            <select
                                                className="form-input"
                                                value={selectedInstallmentId}
                                                onChange={(e) => handleInstallmentChange(e.target.value)}
                                                style={{ width: '100%' }}
                                            >
                                                <option value="">-- Selecciona una cuota --</option>
                                                {pendingInstallments.map(installment => {
                                                    const isOverdue = new Date(installment.dueDate) < new Date();
                                                    return (
                                                        <option key={installment.id} value={installment.id}>
                                                            Cuota #{installment.installmentNumber === 0 ? 'Inicial (Enganche)' : installment.installmentNumber} - {formatCurrency(installment.amount)} - Vence: {new Date(installment.dueDate).toLocaleDateString('es-CO')}{isOverdue ? ' ⚠️ VENCIDA' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            {selectedInstallmentId && (
                                                <div style={{
                                                    marginTop: 'var(--spacing-2)',
                                                    padding: 'var(--spacing-3)',
                                                    background: 'var(--color-primary-500)10',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--color-primary-500)40'
                                                }}>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Monto de la cuota: </span>
                                                    <span style={{ fontWeight: '600', color: 'var(--color-primary-500)' }}>
                                                        {formatCurrency(parseFloat(formData.amount || 0))}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Info: auto-redistribute notice */}
                                            <div style={{
                                                marginTop: 'var(--spacing-3)',
                                                padding: 'var(--spacing-3)',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: 'var(--radius-md)',
                                                fontSize: '0.85rem',
                                                color: 'var(--text-muted)',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: 'var(--spacing-2)'
                                            }}>
                                                <FiCheck style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-success)' }} />
                                                <span>
                                                    Si pagas menos, la diferencia se sumará a la siguiente cuota. Si pagas más, el excedente se descontará desde la última cuota hacia la primera.
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label required">Monto del Pago</label>
                                    <input
                                        type="number"
                                        className={`form-input ${errors.amount ? 'error' : ''}`}
                                        placeholder="1000000"
                                        value={formData.amount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                    />
                                    {errors.amount && <span className="form-error">{errors.amount}</span>}
                                    {pendingAmount > 0 && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm mt-2"
                                            onClick={() => setFormData(prev => ({ ...prev, amount: pendingAmount.toString() }))}
                                        >
                                            Pagar todo ({formatCurrency(pendingAmount)})
                                        </button>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        <FiCalendar style={{ marginRight: '4px' }} />
                                        Fecha de Pago
                                    </label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={formData.paymentDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Notas</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Notas adicionales sobre el pago..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    style={{ minHeight: '80px' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Receipt Upload */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">
                                <FiImage className="card-title-icon" />
                                Comprobante de Pago
                            </h3>
                        </div>
                        <div className="card-body">
                            {!previewImage ? (
                                <label className="file-upload" style={{ cursor: uploadingImage ? 'wait' : 'pointer', display: 'block', position: 'relative' }}>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        style={{ display: 'none' }}
                                        disabled={uploadingImage}
                                    />
                                    {uploadingImage ? (
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-2)'
                                        }}>
                                            <div className="file-upload-icon" style={{ animation: 'spin 1s linear infinite' }}>
                                                <FiLoader />
                                            </div>
                                            <p><strong>Subiendo imagen...</strong></p>
                                            <p className="file-upload-hint">Por favor espera</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="file-upload-icon">
                                                <FiUpload />
                                            </div>
                                            <p style={{ marginBottom: 'var(--spacing-2)' }}>
                                                <strong>Haz clic para subir</strong> o arrastra una imagen
                                            </p>
                                            <p className="file-upload-hint">
                                                PNG, JPG o JPEG (máx. 5MB)
                                            </p>
                                        </>
                                    )}
                                </label>
                            ) : (
                                <div className="file-preview">
                                    <img
                                        src={previewImage}
                                        alt="Comprobante"
                                        style={{
                                            width: '100%',
                                            maxHeight: '300px',
                                            objectFit: 'contain',
                                            borderRadius: 'var(--radius-lg)'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm mt-4"
                                        onClick={removeImage}
                                        style={{ color: 'var(--color-error)' }}
                                    >
                                        <FiX /> Eliminar imagen
                                    </button>
                                </div>
                            )}

                            <p style={{
                                marginTop: 'var(--spacing-4)',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-muted)'
                            }}>
                                Sube una imagen del recibo o comprobante de pago para tener un respaldo digital.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="card mt-6">
                    <div className="card-body">
                        <div className="flex-between">
                            <div>
                                {formData.amount && (
                                    <p style={{ margin: 0 }}>
                                        Registrando pago de{' '}
                                        <strong style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-xl)' }}>
                                            {formatCurrency(formData.amount)}
                                        </strong>
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-4">
                                <Link
                                    to={preselectedSaleId ? `/sales/${preselectedSaleId}` : '/payments'}
                                    className="btn btn-secondary"
                                >
                                    Cancelar
                                </Link>
                                <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                                    {isProcessing ? (
                                        <>
                                            <FiLoader style={{ animation: 'spin 1s linear infinite' }} />
                                            Procesando...
                                        </>
                                    ) : (
                                        <>
                                            <FiSave />
                                            Registrar Pago
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}

export default PaymentForm;
