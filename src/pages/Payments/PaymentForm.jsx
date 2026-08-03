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
    FiSearch,
    FiCreditCard,
    FiPlus
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, safeParseDate, todayBogota } from '../../lib/formatters';
import { storageService } from '../../services/storageService';
import { bankAccountService } from '../../services/bankAccountService';
import { parseBarcodeInput, generatePaymentReceiptHTML, openPrintWindow, writeToPrintWindow } from '../../lib/barcodeUtils';
import { pickImage } from '../../lib/cameraUtils';
import CurrencyInput from '../../components/ui/CurrencyInput';

function PaymentForm() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preselectedSaleId = searchParams.get('saleId');
    const { currentUser } = useAuth();

    const {
        state,
        addPayment,
        getSaleById,
        getClientById,
        getProjectById,
        getPendingAmount,
        getInstallmentsBySale,
        markInstallmentAsPaid,
        markInstallmentAsPartial,
        autoRedistributeInstallments,
        refreshData
    } = useApp();

    const [formData, setFormData] = useState({
        saleId: preselectedSaleId || '',
        amount: '',
        paymentDate: todayBogota(),
        paymentMethod: 'cash',
        receiptImage: '',
        notes: '',
    });

    const [errors, setErrors] = useState({});
    const [previewImage, setPreviewImage] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [pendingInstallments, setPendingInstallments] = useState([]);
    const [allInstallments, setAllInstallments] = useState([]);
    const [selectedInstallmentIds, setSelectedInstallmentIds] = useState([]);
    const [loadingInstallments, setLoadingInstallments] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Bank Accounts
    const [bankAccounts, setBankAccounts] = useState([]);
    const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
    const [showNewAccount, setShowNewAccount] = useState(false);
    const [newAccountData, setNewAccountData] = useState({ bank_name: '', account_type: 'Ahorros', account_number: '', owner_name: '' });
    const [creatingAccount, setCreatingAccount] = useState(false);

    // Barcode scanning
    const [barcodeInput, setBarcodeInput] = useState('');
    const [barcodeError, setBarcodeError] = useState('');
    const barcodeInputRef = useRef(null);

    // Load bank accounts
    useEffect(() => {
        const loadBankAccounts = async () => {
            try {
                const { data } = await bankAccountService.getAll();
                if (data) {
                    // Ítem 4c: Solo mostrar la cuenta terminada en 8977
                    const filtered = data.filter(b => String(b.account_number).endsWith('8977'));
                    setBankAccounts(filtered.length > 0 ? filtered : data);
                    // Auto-seleccionar si hay una sola cuenta
                    if (filtered.length === 1 && !selectedBankAccountId) {
                        setSelectedBankAccountId(filtered[0].id);
                    }
                }
            } catch (err) {
                console.error('Error loading bank accounts:', err);
            }
        };
        loadBankAccounts();
    }, []);

    const handleCreateBankAccount = async () => {
        if (!newAccountData.bank_name || !newAccountData.account_number) return;
        setCreatingAccount(true);
        try {
            const { data, error } = await bankAccountService.create(newAccountData);
            if (!error) {
                const newAccountList = await bankAccountService.getAll();
                if (newAccountList.data) setBankAccounts(newAccountList.data);
                setSelectedBankAccountId(data?.id || '');
                setShowNewAccount(false);
                setNewAccountData({ bank_name: '', account_type: 'Ahorros', account_number: '', owner_name: '' });
            } else {
                alert('Error al crear la cuenta bancaria.');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setCreatingAccount(false);
        }
    };



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

    // Load ALL installments when sale changes (to show full grid)
    useEffect(() => {
        const loadInstallments = async () => {
            if (formData.saleId && isInstallmentSale) {
                setLoadingInstallments(true);
                try {
                    const { data, error } = await getInstallmentsBySale(formData.saleId);
                    if (!error && data) {
                        // Normalize installment data
                        const normalized = data.map(inst => ({
                            ...inst,
                            installmentNumber: inst.installment_number ?? inst.installmentNumber,
                            dueDate: inst.due_date || inst.dueDate,
                            paidAmount: parseFloat(inst.paid_amount || inst.paidAmount || 0)
                        }));
                        setAllInstallments(normalized);
                        setPendingInstallments(normalized.filter(i => i.status !== 'paid'));
                    }
                } catch (err) {
                    console.error('Error loading installments:', err);
                } finally {
                    setLoadingInstallments(false);
                }
            } else {
                setPendingInstallments([]);
                setAllInstallments([]);
            }
            setSelectedInstallmentIds([]);
        };
        loadInstallments();
    }, [formData.saleId, isInstallmentSale]);

    // Update amount when installment is selected — usa saldo pendiente (amount - paid)
    const handleInstallmentChange = (installmentId) => {
        setSelectedInstallmentIds(prev => {
            let next;
            if (prev.includes(installmentId)) {
                next = prev.filter(id => id !== installmentId);
            } else {
                next = [...prev, installmentId];
            }
            
            const total = next.reduce((sum, id) => {
                const inst = pendingInstallments.find(i => i.id === id);
                if (!inst) return sum;
                // Usar saldo pendiente (restando lo ya pagado en pagos parciales)
                const remaining = parseFloat(inst.amount) - parseFloat(inst.paidAmount || inst.paid_amount || 0);
                return sum + Math.max(0, remaining);
            }, 0);
            
            setFormData(fd => ({ ...fd, amount: total > 0 ? total.toString() : '' }));
            return next;
        });
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
        if (formData.paymentMethod === 'transfer' && !selectedBankAccountId) {
            newErrors.bankAccount = 'Selecciona una cuenta bancaria';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handlePickImage = async () => {
        const result = await pickImage();
        if (!result) return;

        const { file, preview } = result;

        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen no puede ser mayor a 5MB');
            return;
        }

        // Show preview immediately
        setPreviewImage(preview);

        // Upload to server
        setUploadingImage(true);
        try {
            const { data: uploadData, error } = await storageService.uploadFile(file);
            const url = uploadData?.url;
            if (error) {
                console.error('Error uploading image:', error);
                alert('Error al subir la imagen. Se guardará localmente.');
                setFormData(prev => ({ ...prev, receiptImage: preview }));
            } else {
                setFormData(prev => ({ ...prev, receiptImage: url }));
            }
        } catch (err) {
            console.error('Error uploading:', err);
            setFormData(prev => ({ ...prev, receiptImage: preview }));
        } finally {
            setUploadingImage(false);
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
                paymentMethod: formData.paymentMethod || 'cash',
                bankAccountId: formData.paymentMethod === 'transfer' ? selectedBankAccountId : null,
                receiptImage: formData.receiptImage,
                notes: formData.notes,
            };

            const payment = await addPayment(paymentData);

            // 2. Handle installment logic
            if (isInstallmentSale && pendingInstallments.length > 0 && payment && payment.id) {
                if (selectedInstallmentIds.length === 1) {
                    // Cuota única seleccionada: evaluar si es pago completo o parcial
                    const selectedInst = pendingInstallments.find(i => i.id === selectedInstallmentIds[0]);
                    const instBalance = selectedInst
                        ? parseFloat(selectedInst.amount) - parseFloat(selectedInst.paidAmount || selectedInst.paid_amount || 0)
                        : 0;

                    if (Math.abs(paymentAmount - instBalance) < 0.01 || paymentAmount >= instBalance) {
                        // Pago completo → marcar como pagada
                        await markInstallmentAsPaid(selectedInstallmentIds[0], payment.id);
                    } else {
                        // Pago parcial (Opção A) → marcar como 'partial' con saldo visible
                        await markInstallmentAsPartial(selectedInstallmentIds[0], paymentAmount + parseFloat(selectedInst?.paidAmount || 0));
                    }
                } else if (selectedInstallmentIds.length > 1) {
                    // Múltiples cuotas: si la suma exacta, marca todas como pagadas
                    const totalSelectedAmount = selectedInstallmentIds.reduce((sum, id) => {
                        const inst = pendingInstallments.find(i => i.id === id);
                        return sum + (inst ? parseFloat(inst.amount) - parseFloat(inst.paidAmount || 0) : 0);
                    }, 0);

                    if (Math.abs(paymentAmount - totalSelectedAmount) < 0.01) {
                        for (const id of selectedInstallmentIds) {
                            try {
                                await markInstallmentAsPaid(id, payment.id);
                            } catch (err) {
                                console.error('Error marking installment as paid:', err);
                            }
                        }
                    } else {
                        await autoRedistributeInstallments(formData.saleId, paymentAmount, payment.id);
                    }
                } else {
                    // Sin cuota seleccionada: redistribuir automáticamente
                    await autoRedistributeInstallments(formData.saleId, paymentAmount, payment.id);
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
                    project,
                    currentUser,
                    selectedInstallmentIds,
                    installments: allInstallments
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

    const navigateAfterPayment = async () => {
        setIsProcessing(true);
        try {
            await refreshData();
        } catch (e) {
            console.error(e);
        }
        
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
            {!preselectedSaleId && import.meta.env.VITE_BRAND !== 'diamante' && (
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

                            {/* Installments Grid Section */}
                            {isInstallmentSale && selectedSale && (
                                <div className="form-group">
                                    <label className="form-label">
                                        <FiCalendar style={{ marginRight: '4px' }} />
                                        Seleccionar Cuota a Pagar
                                    </label>
                                    {loadingInstallments ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: 'var(--spacing-3)' }}>
                                            <FiLoader style={{ animation: 'spin 1s linear infinite' }} />
                                            <span style={{ color: 'var(--text-muted)' }}>Cargando cuotas...</span>
                                        </div>
                                    ) : allInstallments.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)', margin: 0, padding: 'var(--spacing-2)' }}>
                                            No hay cuotas registradas para esta venta.
                                        </p>
                                    ) : (
                                        <>
                                            {/* Installment Grid */}
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                                gap: 'var(--spacing-3)',
                                                marginTop: 'var(--spacing-2)'
                                            }}>
                                                {allInstallments.map(installment => {
                                                    const instNum = parseInt(installment.installmentNumber);
                                                    const isPaid = installment.status === 'paid';
                                                    const isPartial = installment.status === 'partial';
                                                    const isOverdue = !isPaid && safeParseDate(installment.dueDate) < new Date();
                                                    const isSelected = selectedInstallmentIds.includes(installment.id);
                                                    const isSelectable = !isPaid;

                                                    // Label based on installment number
                                                    let label = `Cuota #${instNum}`;
                                                    if (instNum === -1) label = 'Separe';
                                                    else if (instNum === 0) label = 'Inicial';

                                                    // Color based on status
                                                    let bgColor, borderColor, textColor, statusIcon, statusLabel;
                                                    if (isPaid) {
                                                        bgColor = 'rgba(16, 185, 129, 0.12)';
                                                        borderColor = 'rgba(16, 185, 129, 0.5)';
                                                        textColor = '#10b981';
                                                        statusIcon = '✅';
                                                        statusLabel = 'Pagada';
                                                    } else if (isPartial) {
                                                        bgColor = 'rgba(245, 158, 11, 0.12)';
                                                        borderColor = 'rgba(245, 158, 11, 0.5)';
                                                        textColor = '#f59e0b';
                                                        statusIcon = '🟡';
                                                        statusLabel = `Abonado: ${formatCurrency(installment.paidAmount)}`;
                                                    } else if (isOverdue) {
                                                        bgColor = 'rgba(239, 68, 68, 0.12)';
                                                        borderColor = 'rgba(239, 68, 68, 0.5)';
                                                        textColor = '#ef4444';
                                                        statusIcon = '🔴';
                                                        statusLabel = 'Vencida';
                                                    } else {
                                                        bgColor = 'rgba(250, 204, 21, 0.08)';
                                                        borderColor = 'rgba(250, 204, 21, 0.35)';
                                                        textColor = '#eab308';
                                                        statusIcon = '🟡';
                                                        statusLabel = 'Pendiente';
                                                    }

                                                    // Selected override
                                                    if (isSelected) {
                                                        bgColor = 'rgba(99, 102, 241, 0.15)';
                                                        borderColor = 'var(--color-primary-500)';
                                                    }

                                                    return (
                                                        <div
                                                            key={installment.id}
                                                            onClick={() => isSelectable && handleInstallmentChange(installment.id)}
                                                            style={{
                                                                background: bgColor,
                                                                border: `2px solid ${borderColor}`,
                                                                borderRadius: 'var(--radius-lg)',
                                                                padding: 'var(--spacing-3)',
                                                                cursor: isSelectable ? 'pointer' : 'default',
                                                                opacity: isPaid ? 0.6 : 1,
                                                                transition: 'all 0.2s ease',
                                                                textAlign: 'center',
                                                                position: 'relative',
                                                                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                                                                boxShadow: isSelected ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
                                                            }}
                                                        >
                                                            {/* Label */}
                                                            <div style={{
                                                                fontWeight: '700',
                                                                fontSize: 'var(--font-size-xs)',
                                                                color: isSelected ? 'var(--color-primary-400)' : textColor,
                                                                marginBottom: '4px',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.5px'
                                                            }}>
                                                                {label}
                                                            </div>
                                                            {/* Amount */}
                                                            <div style={{
                                                                fontWeight: '600',
                                                                fontSize: 'var(--font-size-base)',
                                                                color: 'var(--text-primary)',
                                                                marginBottom: '4px'
                                                            }}>
                                                                {formatCurrency(installment.amount)}
                                                            </div>
                                                            {/* Due Date */}
                                                            <div style={{
                                                                fontSize: 'var(--font-size-xs)',
                                                                color: 'var(--text-muted)',
                                                                marginBottom: '4px'
                                                            }}>
                                                                {safeParseDate(installment.dueDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                                            </div>
                                                            {/* Status */}
                                                            <div style={{
                                                                fontSize: '0.7rem',
                                                                color: textColor,
                                                                fontWeight: '500'
                                                            }}>
                                                                {statusIcon} {statusLabel}
                                                            </div>
                                                            {/* Selected check */}
                                                            {isSelected && (
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    top: '4px',
                                                                    right: '4px',
                                                                    background: 'var(--color-primary-500)',
                                                                    color: 'white',
                                                                    borderRadius: '50%',
                                                                    width: '18px',
                                                                    height: '18px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '10px'
                                                                }}>
                                                                    <FiCheck />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Selected installment details */}
                                            {selectedInstallmentIds.length > 0 && (
                                                <div style={{
                                                    marginTop: 'var(--spacing-3)',
                                                    padding: 'var(--spacing-3)',
                                                    background: 'var(--color-primary-500)10',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--color-primary-500)40'
                                                }}>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Monto total seleccionado ({selectedInstallmentIds.length} cuotas): </span>
                                                    <span style={{ fontWeight: '600', color: 'var(--color-primary-500)' }}>
                                                        {formatCurrency(parseFloat(formData.amount || 0))}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Legend */}
                                            <div style={{
                                                marginTop: 'var(--spacing-3)',
                                                display: 'flex',
                                                gap: 'var(--spacing-4)',
                                                flexWrap: 'wrap',
                                                fontSize: 'var(--font-size-xs)',
                                                color: 'var(--text-muted)'
                                            }}>
                                                <span>✅ Pagada</span>
                                                <span>🟡 Pendiente</span>
                                                <span>🟠 Parcial</span>
                                                <span>🔴 Vencida</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label required">Monto del Pago</label>
                                    <CurrencyInput
                                        className={`form-input ${errors.amount ? 'error' : ''}`}
                                        placeholder="1000000"
                                        value={formData.amount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                    />{/* Indicator: pago parcial vs. pago total */}
                                    {selectedInstallmentIds.length === 1 && formData.amount && (() => {
                                        const selInst = pendingInstallments.find(i => i.id === selectedInstallmentIds[0]);
                                        if (!selInst) return null;
                                        const balance = parseFloat(selInst.amount) - parseFloat(selInst.paidAmount || 0);
                                        const paid = parseFloat(formData.amount || 0);
                                        const isPartial = paid > 0 && paid < balance - 0.01;
                                        const isFull = Math.abs(paid - balance) < 0.01 || paid >= balance;
                                        if (isPartial) return (
                                            <div style={{ marginTop: '6px', padding: '6px 10px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', color: '#b45309' }}>
                                                🟡 <strong>Pago Parcial</strong> — Saldo restante en cuota: {formatCurrency(balance - paid)}
                                            </div>
                                        );
                                        if (isFull) return (
                                            <div style={{ marginTop: '6px', padding: '6px 10px', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', color: '#059669' }}>
                                                ✅ <strong>Pago Completo</strong> — Cuota quedará como pagada
                                            </div>
                                        );
                                        return null;
                                    })()}
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

                            {/* Payment Method */}
                            <div className="form-group">
                                <label className="form-label">
                                    <FiCreditCard style={{ marginRight: '4px' }} />
                                    Método de Pago
                                </label>
                                <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
                                    <button
                                        type="button"
                                        className={`btn ${formData.paymentMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'cash' }))}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: 'var(--spacing-3) var(--spacing-4)',
                                            border: formData.paymentMethod === 'cash'
                                                ? '2px solid var(--color-primary-500)'
                                                : '2px solid var(--border-color)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>💵</span> Efectivo
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn ${formData.paymentMethod === 'transfer' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'transfer' }))}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: 'var(--spacing-3) var(--spacing-4)',
                                            border: formData.paymentMethod === 'transfer'
                                                ? '2px solid var(--color-primary-500)'
                                                : '2px solid var(--border-color)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>🏦</span> Transferencia
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn ${formData.paymentMethod === 'permuta' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'permuta' }))}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: 'var(--spacing-3) var(--spacing-4)',
                                            border: formData.paymentMethod === 'permuta'
                                                ? '2px solid var(--color-primary-500)'
                                                : '2px solid var(--border-color)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>🔄</span> Permuta
                                    </button>
                                </div>
                            </div>

                            {formData.paymentMethod === 'transfer' && (
                                <div className="form-group" style={{ marginTop: 'var(--spacing-3)', background: 'var(--bg-tertiary)', padding: 'var(--spacing-3)', borderRadius: 'var(--radius-md)' }}>
                                    <div className="flex-between mb-2">
                                        <label className="form-label required m-0">Cuenta Bancaria Destino</label>
                                    </div>
                                    
                                    {showNewAccount ? (
                                        <div style={{ background: 'var(--bg-primary)', padding: 'var(--spacing-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: 'var(--spacing-3)' }}>
                                            <h4 style={{ margin: '0 0 var(--spacing-3) 0', fontSize: 'var(--font-size-sm)' }}>Crear Cuenta Bancaria</h4>
                                            <div className="grid grid-2" style={{ gap: 'var(--spacing-2)' }}>
                                                <input type="text" className="form-input" placeholder="Banco (ej. Bancolombia)" value={newAccountData.bank_name} onChange={e => setNewAccountData(p => ({...p, bank_name: e.target.value}))} />
                                                <select className="form-select" value={newAccountData.account_type} onChange={e => setNewAccountData(p => ({...p, account_type: e.target.value}))}>
                                                    <option value="Ahorros">Ahorros</option>
                                                    <option value="Corriente">Corriente</option>
                                                </select>
                                                <input type="text" className="form-input" placeholder="Número de cuenta" value={newAccountData.account_number} onChange={e => setNewAccountData(p => ({...p, account_number: e.target.value}))} />
                                                <input type="text" className="form-input" placeholder="Titular (opcional)" value={newAccountData.owner_name} onChange={e => setNewAccountData(p => ({...p, owner_name: e.target.value}))} />
                                            </div>
                                            <div className="flex justify-end mt-3 gap-2">
                                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNewAccount(false)}>Cancelar</button>
                                                <button type="button" className="btn btn-primary btn-sm" onClick={handleCreateBankAccount} disabled={creatingAccount || !newAccountData.bank_name || !newAccountData.account_number}>
                                                    {creatingAccount ? 'Guardando...' : 'Guardar Cuenta'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <select 
                                                className={`form-select ${errors.bankAccount ? 'error' : ''}`}
                                                value={selectedBankAccountId}
                                                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                                            >
                                                <option value="">Selecciona una cuenta</option>
                                                {bankAccounts.map(b => (
                                                    <option key={b.id} value={b.id}>
                                                        {b.bank_name} - {b.account_type} {b.account_number} {b.owner_name ? `(${b.owner_name})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.bankAccount && <span className="form-error">{errors.bankAccount}</span>}
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="form-group" style={{ marginTop: 'var(--spacing-3)' }}>
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
                                <div
                                    className="file-upload"
                                    style={{ cursor: uploadingImage ? 'wait' : 'pointer', display: 'block', position: 'relative' }}
                                    onClick={!uploadingImage ? handlePickImage : undefined}
                                    role="button"
                                    tabIndex={0}
                                >
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
                                                <strong>Tomar foto o seleccionar imagen</strong>
                                            </p>
                                            <p className="file-upload-hint">
                                                PNG, JPG o JPEG (máx. 5MB)
                                            </p>
                                        </>
                                    )}
                                </div>
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
