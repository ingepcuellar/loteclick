import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
    FiArrowLeft,
    FiSave,
    FiShoppingCart,
    FiUser,
    FiPlus,
    FiDollarSign,
    FiCalendar,
    FiX,
    FiUserPlus,
    FiAlertTriangle,
    FiCheck,
    FiTrash2
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, todayBogota } from '../../lib/formatters';
import { getLotLabel } from '../../lib/lotLabel';
import { commissionAgentService } from '../../services/commissionAgentService';
import { contractParamsService } from '../../services/contractParamsService';
import { generatePaymentSlipHTML, openPrintWindow, writeToPrintWindow } from '../../lib/barcodeUtils';
import { brand } from '../../config/brandConfig';
import CurrencyInput from '../../components/ui/CurrencyInput';

function SaleForm() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { state, addSale, addClient, getClientById, getProjectById, getPendingInstallmentsBySale } = useApp();
    const { currentUser } = useAuth();

    const [formData, setFormData] = useState({
        projectId: '',
        clientId: '',
        paymentType: 'installments',
        numberOfInstallments: 12,
        downPayment: '',
        separeAmount: '',
        saleDate: todayBogota(),
        notes: '',
        commissionAgent: '',
        commissionAgentId: '',
        commissionAmount: '',
        includeAcometida: false,
        acometidaValue: '',
        acometidaPaid: false,
        useCustomPlan: false,
        customPlan: [],
    });

    // Multi-lot selection: array of { lotId, lotNumber, originalPrice, salePrice }
    const [selectedLots, setSelectedLots] = useState([]);

    // Sale mode: 'separate' (one sale per lot) or 'grouped' (one sale, all lots)
    const [saleMode, setSaleMode] = useState('separate');

    // Discount authorization
    const [discountPartnerId, setDiscountPartnerId] = useState('');
    const [discountPartnerName, setDiscountPartnerName] = useState('');

    const [showNewClient, setShowNewClient] = useState(false);
    const [newClient, setNewClient] = useState({
        fullName: '',
        document: '',
        phone: '',
        email: '',
        address: '',
    });

    // Commission agents
    const [commissionAgents, setCommissionAgents] = useState([]);
    const [showNewAgent, setShowNewAgent] = useState(false);
    const [newAgent, setNewAgent] = useState({ name: '', phone: '', document: '' });
    const [creatingAgent, setCreatingAgent] = useState(false);

    const [errors, setErrors] = useState({});
    const [availableLots, setAvailableLots] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Ítem 9: tipo de redondeo de cuotas en miles de COP
    const [roundingType, setRoundingType] = useState('nearest'); // 'nearest' | 'ceil' | 'floor'

    // Initial payment % from contract params (configurable in Settings)
    const [initialPaymentPct, setInitialPaymentPct] = useState(20);

    // Load initial payment percentage from settings
    useEffect(() => {
        contractParamsService.getParams().then(({ data }) => {
            const p = data?.data || data;
            if (p?.initial_payment_pct) {
                setInitialPaymentPct(parseFloat(p.initial_payment_pct) || 20);
            }
        }).catch(() => {});
    }, []);

    // Get project partners for discount authorization
    const currentProject = state.projects.find(p => p.id === formData.projectId);
    const projectPartners = currentProject?.partners || [];

    // Check if any lot has a discount
    const hasDiscount = selectedLots.some(lot => {
        const orig = parseFloat(lot.originalPrice) || 0;
        const sale = parseFloat(lot.salePrice) || 0;
        return orig > 0 && sale > 0 && sale < orig;
    });

    const totalDiscountAmount = selectedLots.reduce((sum, lot) => {
        const orig = parseFloat(lot.originalPrice) || 0;
        const sale = parseFloat(lot.salePrice) || 0;
        const diff = orig - sale;
        return sum + (diff > 0 ? diff : 0);
    }, 0);

    // Load commission agents
    useEffect(() => {
        const loadAgents = async () => {
            try {
                const { data } = await commissionAgentService.getAll();
                if (data) setCommissionAgents(data);
            } catch (err) {
                console.error('Error loading commission agents:', err);
            }
        };
        loadAgents();
    }, []);

    const handleCreateAgent = async () => {
        if (!newAgent.name.trim()) return;
        setCreatingAgent(true);
        try {
            const { data, error } = await commissionAgentService.create(newAgent);
            if (error) {
                alert('Error: ' + (error.message || 'No se pudo crear el comisionista'));
                return;
            }
            if (data) {
                setCommissionAgents(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
                setFormData(prev => ({
                    ...prev,
                    commissionAgentId: data.id,
                    commissionAgent: data.name
                }));
                setShowNewAgent(false);
                setNewAgent({ name: '', phone: '', document: '' });
            }
        } catch (err) {
            console.error('Error creating agent:', err);
            alert('Error al crear el comisionista');
        } finally {
            setCreatingAgent(false);
        }
    };

    // Read URL params on mount (from lot matrix click)
    useEffect(() => {
        const urlProjectId = searchParams.get('projectId');
        const urlLotId = searchParams.get('lotId');
        if (urlProjectId) {
            setFormData(prev => ({ ...prev, projectId: urlProjectId }));
            if (urlLotId) {
                const project = state.projects.find(p => p.id === urlProjectId);
                const lot = project?.lots?.find(l => l.id === urlLotId);
                if (lot) {
                    setSelectedLots([{
                        lotId: lot.id,
                        lotNumber: lot.number,
                        lotManzana: lot.manzana || null,
                        originalPrice: lot.price || 0,
                        salePrice: lot.price?.toString() || ''
                    }]);
                }
            }
        }
    }, []);

    // Update available lots when project changes
    useEffect(() => {
        if (formData.projectId) {
            const project = state.projects.find(p => p.id === formData.projectId);
            if (project) {
                const lots = project.lots?.filter(l => l.status !== 'sold' && l.status !== 'pending_initial') || [];
                setAvailableLots(lots);
            }
        } else {
            setAvailableLots([]);
            setSelectedLots([]);
        }
    }, [formData.projectId, state.projects]);

    // Add a lot to the selection
    const handleAddLot = (lotId) => {
        if (!lotId || selectedLots.find(sl => sl.lotId === lotId)) return;
        const lot = availableLots.find(l => l.id === lotId);
        if (lot) {
            setSelectedLots(prev => [...prev, {
                lotId: lot.id,
                lotNumber: lot.number,
                lotManzana: lot.manzana || null,
                originalPrice: lot.price || 0,
                salePrice: lot.price?.toString() || ''
            }]);
        }
    };

    // Remove a lot from the selection
    const handleRemoveLot = (lotId) => {
        setSelectedLots(prev => prev.filter(sl => sl.lotId !== lotId));
    };

    // Update sale price for a specific lot
    const handleLotPriceChange = (lotId, newPrice) => {
        setSelectedLots(prev => prev.map(sl =>
            sl.lotId === lotId ? { ...sl, salePrice: newPrice } : sl
        ));
    };



    const validate = () => {
        const newErrors = {};

        if (!formData.projectId) newErrors.projectId = 'Selecciona un proyecto';
        if (selectedLots.length === 0) newErrors.lots = 'Selecciona al menos un lote';
        if (!formData.clientId && !showNewClient) newErrors.clientId = 'Selecciona o crea un cliente';

        // Validate each lot has a valid price
        selectedLots.forEach(lot => {
            if (!lot.salePrice || parseFloat(lot.salePrice) <= 0) {
                newErrors.lots = 'Todos los lotes deben tener un precio válido';
            }
        });

        // Discount requires partner authorization
        if (hasDiscount && !discountPartnerId) {
            newErrors.discountPartner = 'Selecciona el socio que autoriza el descuento';
        }

        if (showNewClient) {
            if (!newClient.fullName.trim()) newErrors.newClientName = 'El nombre es requerido';
            if (!newClient.document.trim()) newErrors.newClientDocument = 'El documento es requerido';
        }

        const customPlanTotal = formData.customPlan.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const grandTotal = selectedLots.reduce((sum, lot) => sum + (parseFloat(lot.salePrice) || 0), 0);

        if (formData.paymentType === 'installments' && formData.useCustomPlan && (selectedLots.length === 1 || saleMode === 'grouped')) {
            const diff = Math.abs(customPlanTotal - grandTotal);
            if (diff > 1) { // allow 1 peso rounding difference
                newErrors.customPlan = 'La suma de las cuotas debe ser exactamente igual al precio total de venta.';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) return;

        // Determine how many receipt windows to open
        const numReceipts = (saleMode === 'grouped' || selectedLots.length === 1) ? 1 : selectedLots.length;
        const receiptWindows = Array.from({ length: numReceipts }, () => openPrintWindow());

        setIsSubmitting(true);

        let clientId = formData.clientId;

        // Create new client if needed
        if (showNewClient) {
            const createdClient = await addClient(newClient);
            if (!createdClient) {
                console.error('Failed to create client');
                receiptWindows.forEach(w => { if (w && !w.closed) w.close(); });
                setIsSubmitting(false);
                return;
            }
            clientId = createdClient.id;
        }

        const clientName = showNewClient ? newClient.fullName : (state.clients.find(c => c.id === clientId)?.name || 'Cliente');
        const createdSales = [];

        if (saleMode === 'grouped' && selectedLots.length > 1) {
            // GROUPED MODE: Create one sale with all lots
            const primaryLot = selectedLots[0];
            const totalOriginal = selectedLots.reduce((s, l) => s + (parseFloat(l.originalPrice) || 0), 0);
            const totalSale = grandTotal;
            const groupDiscount = totalOriginal > totalSale && totalSale > 0 ? totalOriginal - totalSale : 0;
            const lotNumbers = selectedLots.map(l => l.lotNumber).join(', ');

            const saleData = {
                projectId: formData.projectId,
                lotId: primaryLot.lotId,
                lotNumber: lotNumbers,
                clientId: clientId,
                totalPrice: totalSale + (formData.includeAcometida ? (parseFloat(formData.acometidaValue) || 0) : 0),
                paymentType: formData.paymentType,
                numberOfInstallments: formData.paymentType === 'installments' ? parseInt(formData.numberOfInstallments) : 1,
                downPayment: parseFloat(formData.downPayment) || 0,
                separeAmount: parseFloat(formData.separeAmount) || 0,
                saleDate: formData.saleDate,
                notes: formData.notes,
                commissionAgent: formData.commissionAgent || null,
                commissionAgentId: formData.commissionAgentId || null,
                commissionAmount: formData.commissionAgentId ? (parseFloat(formData.commissionAmount) || null) : null,
                originalPrice: groupDiscount > 0 ? totalOriginal : null,
                discountAmount: groupDiscount > 0 ? groupDiscount : null,
                discountAuthorizedBy: groupDiscount > 0 ? discountPartnerId : null,
                discountPartnerName: groupDiscount > 0 ? discountPartnerName : null,
                clientName: clientName,
                includeAcometida: formData.includeAcometida,
                acometidaValue: parseFloat(formData.acometidaValue) || 0,
                acometidaPaid: formData.acometidaPaid,
                customPlan: formData.useCustomPlan ? formData.customPlan : null,
                // Send all lots for the sale_lots junction table
                saleLots: selectedLots.map(lot => ({
                    lotId: lot.lotId,
                    lotNumber: lot.lotNumber,
                    originalPrice: parseFloat(lot.originalPrice) || 0,
                    salePrice: parseFloat(lot.salePrice) || 0
                })),
            };

            try {
                const createdSale = await addSale(saleData);
                if (createdSale && createdSale.id) {
                    createdSales.push({ sale: createdSale, lot: { ...primaryLot, lotNumber: lotNumbers, salePrice: totalSale }, index: 0 });
                }
            } catch (err) {
                console.error('Error creating grouped sale:', err);
                alert('❌ Error al crear la venta: ' + (err.message || 'Error desconocido'));
                setIsSubmitting(false);
                return;
            }
        } else {
            // SEPARATE MODE: Create one sale per lot
            for (let i = 0; i < selectedLots.length; i++) {
                const lot = selectedLots[i];
                const originalPrice = parseFloat(lot.originalPrice) || 0;
                const salePrice = parseFloat(lot.salePrice) || 0;
                const lotDiscount = originalPrice > salePrice && salePrice > 0 ? originalPrice - salePrice : 0;

                const saleData = {
                    projectId: formData.projectId,
                    lotId: lot.lotId,
                    lotNumber: lot.lotNumber,
                    clientId: clientId,
                    totalPrice: salePrice + (formData.includeAcometida ? (parseFloat(formData.acometidaValue) || 0) : 0),
                    paymentType: formData.paymentType,
                    numberOfInstallments: formData.paymentType === 'installments' ? parseInt(formData.numberOfInstallments) : 1,
                    downPayment: parseFloat(formData.downPayment) || 0,
                    separeAmount: parseFloat(formData.separeAmount) || 0,
                    saleDate: formData.saleDate,
                    notes: formData.notes,
                    commissionAgent: formData.commissionAgent || null,
                    commissionAgentId: formData.commissionAgentId || null,
                    commissionAmount: formData.commissionAgentId ? (parseFloat(formData.commissionAmount) || null) : null,
                    originalPrice: lotDiscount > 0 ? originalPrice : null,
                    discountAmount: lotDiscount > 0 ? lotDiscount : null,
                    discountAuthorizedBy: lotDiscount > 0 ? discountPartnerId : null,
                    discountPartnerName: lotDiscount > 0 ? discountPartnerName : null,
                    clientName: clientName,
                    includeAcometida: formData.includeAcometida,
                    acometidaValue: parseFloat(formData.acometidaValue) || 0,
                    acometidaPaid: formData.acometidaPaid,
                    // custom plan for separated sales won't work well out of the box unless it's only 1 lot
                    customPlan: (formData.useCustomPlan && selectedLots.length === 1) ? formData.customPlan : null,
                };

                try {
                    const createdSale = await addSale(saleData);
                    if (createdSale && createdSale.id) {
                        createdSales.push({ sale: createdSale, lot, index: i });
                    }
                } catch (err) {
                    console.error(`Error creating sale for lot ${lot.lotNumber}:`, err);
                    alert('❌ Error al crear la venta: ' + (err.message || 'Error desconocido'));
                    setIsSubmitting(false);
                    return;
                }
            }
        }

        // Write payment slips to pre-opened windows
        for (const { sale, lot, index } of createdSales) {
            try {
                const client = getClientById(clientId) || (showNewClient ? newClient : null);
                const project = getProjectById(formData.projectId);

                let installments = [];
                if (formData.paymentType === 'installments') {
                    try {
                        const { data } = await getPendingInstallmentsBySale(sale.id);
                        if (data) installments = data;
                    } catch (err) {
                        console.error('Error loading installments for receipt:', err);
                    }
                }

                const normalizedSale = {
                    ...sale,
                    lotNumber: lot.lotNumber,
                    totalPrice: parseFloat(lot.salePrice),
                    paymentType: formData.paymentType,
                    downPayment: parseFloat(formData.downPayment) || 0,
                    numberOfInstallments: formData.paymentType === 'installments' ? parseInt(formData.numberOfInstallments) : 1,
                    saleDate: formData.saleDate,
                };

                const html = generatePaymentSlipHTML({
                    sale: normalizedSale,
                    client,
                    project,
                    installments,
                    currentUser
                });
                writeToPrintWindow(receiptWindows[index], html);
            } catch (err) {
                console.error('Error generating payment slip:', err);
                if (receiptWindows[index] && !receiptWindows[index].closed) receiptWindows[index].close();
            }
        }

        // Close any unused windows (for failed sales)
        for (let i = 0; i < receiptWindows.length; i++) {
            if (!createdSales.find(cs => cs.index === i)) {
                if (receiptWindows[i] && !receiptWindows[i].closed) receiptWindows[i].close();
            }
        }

        // Open WhatsApp for discount notification if applicable
        if (hasDiscount && discountPartnerId) {
            const partner = projectPartners.find(p => p.id === discountPartnerId);
            if (partner?.phone) {
                const phone = partner.phone.replace(/\D/g, '');
                const fullPhone = phone.startsWith('57') ? phone : `57${phone}`;
                const lotNumbers = selectedLots.map(l => `#${l.lotNumber}`).join(', ');
                const message = encodeURIComponent(
                    `${brand.emoji} *${brand.appName} - Solicitud de Descuento*\n\n` +
                    `Hola ${partner.name}, se ha registrado un descuento de ${formatCurrency(totalDiscountAmount)} ` +
                    `en la venta del Lote ${lotNumbers} al cliente ${clientName}.\n\n` +
                    `La venta se realizó normalmente. Por favor ingrese al sistema para revisar y aprobar el descuento.\n\n` +
                    `¡Gracias!`
                );
                window.open(`https://wa.me/${fullPhone}?text=${message}`, '_blank');
            }
        }

        setIsSubmitting(false);
        // Redirigir al formulario de pago con la venta recién creada precargada
        if (createdSales.length === 1) {
            navigate(`/payments/new?saleId=${createdSales[0].sale.id}`);
        } else if (createdSales.length > 1) {
            // Múltiples lotes: redirigir con la primera venta y mostrar mensaje
            navigate(`/payments/new?saleId=${createdSales[0].sale.id}`);
        } else {
            navigate('/sales');
        }
    };

    // Ítem 9: Prorrateo de cuotas con redondeo configurable en miles de COP
    const roundToThousand = (value, type = roundingType) => {
        const inK = value / 1000;
        if (type === 'ceil')  return Math.ceil(inK)  * 1000;
        if (type === 'floor') return Math.floor(inK) * 1000;
        return Math.round(inK) * 1000; // 'nearest'
    };

    const calculateInstallment = (totalPrice) => {
        const total = parseFloat(totalPrice) || 0;
        const down = parseFloat(formData.downPayment) || 0;
        const remaining = total - down;
        const installments = parseInt(formData.numberOfInstallments) || 1;
        return roundToThousand(remaining / installments);
    };

    // Diferencia de ajuste que la \u00faltima cuota absorbe
    const lastInstallmentAdjust = (lotPrice) => {
        const total = parseFloat(lotPrice) || 0;
        const down = parseFloat(formData.downPayment) || 0;
        const n = parseInt(formData.numberOfInstallments) || 1;
        const rounded = calculateInstallment(lotPrice);
        return (total - down) - (rounded * n);
    };

    // Calculate totals from selected lots
    const grandTotal = selectedLots.reduce((sum, lot) => sum + (parseFloat(lot.salePrice) || 0), 0);

    const handleGenerateCustomPlan = () => {
        const total = parseFloat(grandTotal) || 0;
        const down = parseFloat(formData.downPayment) || 0;
        const separe = parseFloat(formData.separeAmount) || 0;
        let numInst = parseInt(formData.numberOfInstallments) || 1;
        const startD = new Date(formData.saleDate + 'T12:00:00');
        
        let plan = [];
        
        // Anchor date: the due date of the initial payment (Cuota #0 / Cuota Inicial)
        // Cuota #1 = anchor + 1 month, Cuota #2 = anchor + 2 months, etc.
        let anchorDate = startD; // default anchor = sale date

        if (separe > 0 && down > 0) {
            // Separe paid on sale date
            plan.push({ id: 'temp-'+Math.random(), installmentNumber: -1, amount: separe, dueDate: formData.saleDate });
            // Down payment (remaining) is due 1 month after sale
            const downPaymentDue = new Date(startD);
            downPaymentDue.setMonth(downPaymentDue.getMonth() + 1);
            const downPaymentDueStr = downPaymentDue.toISOString().split('T')[0];
            if (down - separe > 0) {
                plan.push({ id: 'temp-'+Math.random(), installmentNumber: 0, amount: down - separe, dueDate: downPaymentDueStr });
            }
            // Regular installments start 1 month after down payment due date
            anchorDate = downPaymentDue;
        } else if (down > 0) {
            // Down payment due on sale date (no separe)
            plan.push({ id: 'temp-'+Math.random(), installmentNumber: 0, amount: down, dueDate: formData.saleDate });
            // Regular installments start 1 month after sale date (which is the down payment date)
            anchorDate = startD;
        }
        // else no down payment: anchorDate = startD
        
        // Ítem 9: Redondear cada cuota según tipo de redondeo configurado
        const amountPerInst = roundToThousand((total - down) / numInst);
        
        for (let i = 1; i <= numInst; i++) {
            const d = new Date(anchorDate);
            d.setMonth(d.getMonth() + i);
            const amt = (i === numInst) ? (total - down) - (amountPerInst * (numInst - 1)) : amountPerInst;
            plan.push({
                id: 'temp-'+Math.random(),
                installmentNumber: i,
                amount: amt,
                dueDate: d.toISOString().split('T')[0]
            });
        }
        setFormData(prev => ({ ...prev, customPlan: plan }));
    };

    const handleCustomPlanChange = (index, field, value) => {
        const newPlan = [...formData.customPlan];
        newPlan[index][field] = value;
        setFormData(prev => ({ ...prev, customPlan: newPlan }));
    };

    const addCustomInstallment = () => {
        const newPlan = [...formData.customPlan];
        const lastInst = newPlan.length > 0 ? newPlan[newPlan.length - 1] : null;
        let newNum = 1;
        let newDate = formData.saleDate;
        if (lastInst) {
            newNum = parseInt(lastInst.installmentNumber) + 1;
            const d = new Date(lastInst.dueDate + 'T12:00:00');
            d.setMonth(d.getMonth() + 1);
            newDate = d.toISOString().split('T')[0];
        }
        newPlan.push({ id: 'temp-'+Math.random(), installmentNumber: newNum, amount: 0, dueDate: newDate });
        setFormData(prev => ({ ...prev, customPlan: newPlan, numberOfInstallments: newPlan.filter(p => p.installmentNumber > 0).length }));
    };

    const removeCustomInstallment = (index) => {
        const newPlan = [...formData.customPlan];
        newPlan.splice(index, 1);
        setFormData(prev => ({ ...prev, customPlan: newPlan, numberOfInstallments: newPlan.filter(p => p.installmentNumber > 0).length }));
    };

    const customPlanTotal = formData.customPlan.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    // Available lots that are NOT already selected
    const unselectedLots = availableLots
        .filter(l => !selectedLots.find(sl => sl.lotId === l.id))
        .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true, sensitivity: 'base' }));

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <Link to="/sales" className="btn btn-ghost btn-sm mb-2">
                        <FiArrowLeft /> Volver
                    </Link>
                    <h1>Nueva Venta</h1>
                    <p>Registra una nueva venta de lote{selectedLots.length > 1 ? 's' : ''}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-2">
                    {/* Sale Details */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">
                                <FiShoppingCart className="card-title-icon" />
                                Detalles de la Venta
                            </h3>
                        </div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label required">Proyecto</label>
                                <select
                                    className={`form-select ${errors.projectId ? 'error' : ''}`}
                                    value={formData.projectId}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, projectId: e.target.value }));
                                        setSelectedLots([]);
                                        setDiscountPartnerId('');
                                        setDiscountPartnerName('');
                                    }}
                                >
                                    <option value="">Selecciona un proyecto</option>
                                    {state.projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} - {p.location}</option>
                                    ))}
                                </select>
                                {errors.projectId && <span className="form-error">{errors.projectId}</span>}
                            </div>

                            {/* Multi-Lot Selection */}
                            <div className="form-group">
                                <label className="form-label required">Lotes ({selectedLots.length} seleccionados)</label>
                                <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                                    <select
                                        className="form-select"
                                        value=""
                                        onChange={(e) => handleAddLot(e.target.value)}
                                        disabled={!formData.projectId || unselectedLots.length === 0}
                                        style={{ flex: 1 }}
                                    >
                                        <option value="">
                                            {unselectedLots.length > 0
                                                ? 'Agregar lote...'
                                                : (formData.projectId ? 'No hay más lotes disponibles' : 'Selecciona un proyecto primero')
                                            }
                                        </option>
                                        {unselectedLots.map(lot => (
                                            <option key={lot.id} value={lot.id}>
                                                {getLotLabel(lot, currentProject)} - {lot.area}m² - {formatCurrency(lot.price)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {errors.lots && <span className="form-error">{errors.lots}</span>}

                                {/* Selected Lots List */}
                                {selectedLots.length > 0 && (
                                    <div style={{ marginTop: 'var(--spacing-3)' }}>
                                        {selectedLots.map(lot => {
                                            const orig = parseFloat(lot.originalPrice) || 0;
                                            const sale = parseFloat(lot.salePrice) || 0;
                                            const lotHasDiscount = orig > 0 && sale > 0 && sale < orig;

                                            return (
                                                <div key={lot.lotId} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--spacing-3)',
                                                    padding: 'var(--spacing-3)',
                                                    background: lotHasDiscount ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-tertiary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    marginBottom: 'var(--spacing-2)',
                                                    border: lotHasDiscount ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent'
                                                }}>
                                                    <div style={{ flex: '0 0 auto', fontWeight: '600', minWidth: '70px' }}>
                                                        {getLotLabel({ number: lot.lotNumber, manzana: lot.lotManzana }, currentProject)}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                                Precio:
                                                            </span>
                                                            <CurrencyInput
                                                                className="form-input"
                                                                value={lot.salePrice}
                                                                onChange={(e) => handleLotPriceChange(lot.lotId, e.target.value)}
                                                                style={{ flex: 1, padding: '6px 10px', fontSize: 'var(--font-size-sm)' }}
                                                            />
                                                        </div>
                                                        {lotHasDiscount && (
                                                            <div style={{
                                                                fontSize: 'var(--font-size-xs)',
                                                                color: '#f59e0b',
                                                                marginTop: '2px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}>
                                                                <FiAlertTriangle size={12} />
                                                                Descuento: {formatCurrency(orig - sale)} (Precio original: {formatCurrency(orig)})
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveLot(lot.lotId)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'var(--color-error)',
                                                            cursor: 'pointer',
                                                            padding: '4px'
                                                        }}
                                                        title="Quitar lote"
                                                    >
                                                        <FiTrash2 size={16} />
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        {/* Sale mode toggle: only when 2+ lots */}
                                        {selectedLots.length > 1 && (
                                            <div style={{
                                                display: 'flex',
                                                gap: 'var(--spacing-3)',
                                                padding: 'var(--spacing-3)',
                                                background: 'rgba(99, 102, 241, 0.08)',
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                                alignItems: 'center',
                                                flexWrap: 'wrap'
                                            }}>
                                                <span style={{ fontWeight: '500', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                                    Modalidad:
                                                </span>
                                                <label style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: saleMode === 'separate' ? '600' : '400',
                                                    color: saleMode === 'separate' ? 'var(--color-primary-400)' : 'var(--color-text-secondary)'
                                                }}>
                                                    <input
                                                        type="radio"
                                                        name="saleMode"
                                                        value="separate"
                                                        checked={saleMode === 'separate'}
                                                        onChange={() => setSaleMode('separate')}
                                                    />
                                                    Ventas Separadas
                                                </label>
                                                <label style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: saleMode === 'grouped' ? '600' : '400',
                                                    color: saleMode === 'grouped' ? 'var(--color-primary-400)' : 'var(--color-text-secondary)'
                                                }}>
                                                    <input
                                                        type="radio"
                                                        name="saleMode"
                                                        value="grouped"
                                                        checked={saleMode === 'grouped'}
                                                        onChange={() => setSaleMode('grouped')}
                                                    />
                                                    Venta Única
                                                </label>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', flexBasis: '100%' }}>
                                                    {saleMode === 'separate'
                                                        ? 'Cada lote tendrá su propia venta, cuotas y pagos independientes.'
                                                        : 'Todos los lotes se agrupan en una sola venta con un solo plan de pagos.'}
                                                </span>
                                            </div>
                                        )}

                                        {selectedLots.length > 1 && (
                                            <div style={{
                                                padding: 'var(--spacing-3)',
                                                background: 'var(--color-primary-900)',
                                                borderRadius: 'var(--radius-md)',
                                                textAlign: 'right',
                                                fontWeight: '600',
                                                color: 'var(--color-primary-300)'
                                            }}>
                                                Total ({selectedLots.length} lotes): {formatCurrency(grandTotal)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Discount Partner Authorization */}
                            {hasDiscount && (
                                <div className="form-group" style={{
                                    background: 'rgba(245, 158, 11, 0.08)',
                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 'var(--spacing-4)',
                                    marginTop: 'var(--spacing-2)'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-2)',
                                        marginBottom: 'var(--spacing-3)',
                                        color: '#f59e0b',
                                        fontWeight: '600'
                                    }}>
                                        <FiAlertTriangle />
                                        Descuento Detectado: {formatCurrency(totalDiscountAmount)}
                                    </div>
                                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--spacing-3)' }}>
                                        Se modificó el precio de venta. Selecciona el socio que autoriza este descuento.
                                        Se le enviará una notificación para su revisión.
                                    </p>
                                    <label className="form-label required">Socio que Autoriza</label>
                                    <select
                                        className={`form-select ${errors.discountPartner ? 'error' : ''}`}
                                        value={discountPartnerId}
                                        onChange={(e) => {
                                            const pid = e.target.value;
                                            const partner = projectPartners.find(p => p.id === pid);
                                            setDiscountPartnerId(pid);
                                            setDiscountPartnerName(partner?.name || '');
                                        }}
                                    >
                                        <option value="">Selecciona un socio</option>
                                        {projectPartners.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({p.percentage}%)
                                            </option>
                                        ))}
                                    </select>
                                    {errors.discountPartner && <span className="form-error">{errors.discountPartner}</span>}
                                </div>
                            )}

                            <div className="form-row" style={{ marginTop: 'var(--spacing-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">
                                        <FiCalendar style={{ marginRight: '4px' }} />
                                        Fecha de Venta
                                    </label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={formData.saleDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, saleDate: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Forma de Pago</label>
                                <div className="flex gap-4">
                                    <label className="form-checkbox-group">
                                        <input
                                            type="radio"
                                            name="paymentType"
                                            value="cash"
                                            checked={formData.paymentType === 'cash'}
                                            onChange={(e) => setFormData(prev => ({ ...prev, paymentType: e.target.value }))}
                                        />
                                        <span>Contado</span>
                                    </label>
                                    <label className="form-checkbox-group">
                                        <input
                                            type="radio"
                                            name="paymentType"
                                            value="installments"
                                            checked={formData.paymentType === 'installments'}
                                            onChange={(e) => setFormData(prev => ({ ...prev, paymentType: e.target.value }))}
                                        />
                                        <span>Cuotas</span>
                                    </label>
                                </div>
                            </div>

                            {formData.paymentType === 'installments' && (
                                <>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Cuota Inicial</label>
                                            <CurrencyInput
                                                className="form-input"
                                                placeholder="3000000"
                                                value={formData.downPayment}
                                                onChange={(e) => setFormData(prev => ({ ...prev, downPayment: e.target.value }))}
                                            />
                                            {/* Auto-suggest button */}
                                            {grandTotal > 0 && (
                                                <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ fontSize: '0.78rem', padding: '3px 10px', border: '1px solid var(--color-primary-500)', color: 'var(--color-primary-400)' }}
                                                        onClick={() => {
                                                            const suggested = Math.round(grandTotal * initialPaymentPct / 100);
                                                            setFormData(prev => ({ ...prev, downPayment: suggested.toString() }));
                                                        }}
                                                    >
                                                        ⚡ Usar {initialPaymentPct}% ({formatCurrency(Math.round(grandTotal * initialPaymentPct / 100))})
                                                    </button>
                                                    {initialPaymentPct !== 30 && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ fontSize: '0.78rem', padding: '3px 10px' }}
                                                            onClick={() => {
                                                                const suggested = Math.round(grandTotal * 0.3);
                                                                setFormData(prev => ({ ...prev, downPayment: suggested.toString() }));
                                                            }}
                                                        >
                                                            30% ({formatCurrency(Math.round(grandTotal * 0.3))})
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Número de Cuotas</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                min="1"
                                                max="120"
                                                value={formData.numberOfInstallments}
                                                onChange={(e) => setFormData(prev => ({ ...prev, numberOfInstallments: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    {/* Ítem 9: Toggle de redondeo de cuotas */}
                                    <div className="form-group" style={{ marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Redondeo de Cuotas (en miles)</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {[['nearest','Más cercano'],['ceil','Al mayor ⇑'],['floor','Al menor ⇓']].map(([val, lbl]) => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setRoundingType(val)}
                                                    className={`btn btn-sm ${roundingType === val ? 'btn-primary' : 'btn-secondary'}`}
                                                    style={{ flex: 1, fontSize: '0.75rem' }}
                                                >
                                                    {lbl}
                                                </button>
                                            ))}
                                        </div>
                                        {grandTotal > 0 && formData.numberOfInstallments > 0 && formData.downPayment > 0 && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                                                Cuota aprox: <strong>{new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(calculateInstallment(grandTotal))}</strong>
                                            </div>
                                        )}
                                    </div>

                                    {/* Separe Section */}
                                    <div className="form-group" style={{
                                        background: 'rgba(16, 185, 129, 0.08)',
                                        border: '1px solid rgba(16, 185, 129, 0.25)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 'var(--spacing-4)',
                                        marginTop: 'var(--spacing-2)'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-2)',
                                            marginBottom: 'var(--spacing-3)',
                                            color: '#10b981',
                                            fontWeight: '600'
                                        }}>
                                            <FiDollarSign />
                                            Separe (Reserva)
                                        </div>
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--spacing-3)' }}>
                                            Si el cliente paga un separe al momento del negocio, ingresa el monto aquí.
                                            El saldo de la cuota inicial se calculará automáticamente.
                                        </p>
                                        <CurrencyInput
                                            className="form-input"
                                            placeholder="500000"
                                            value={formData.separeAmount}
                                            onChange={(e) => setFormData(prev => ({ ...prev, separeAmount: e.target.value }))}
                                        />
                                        {parseFloat(formData.separeAmount) > 0 && parseFloat(formData.downPayment) > 0 && (
                                            <div style={{
                                                marginTop: 'var(--spacing-3)',
                                                padding: 'var(--spacing-3)',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: 'var(--radius-md)',
                                                fontSize: 'var(--font-size-sm)'
                                            }}>
                                                <div className="flex-between mb-2">
                                                    <span style={{ color: 'var(--text-muted)' }}>Separe (día del negocio):</span>
                                                    <span style={{ fontWeight: '600', color: '#10b981' }}>
                                                        {formatCurrency(formData.separeAmount)}
                                                    </span>
                                                </div>
                                                <div className="flex-between">
                                                    <span style={{ color: 'var(--text-muted)' }}>Saldo de Inicial:</span>
                                                    <span style={{ fontWeight: '600', color: 'var(--color-warning)' }}>
                                                        {formatCurrency(Math.max(0, parseFloat(formData.downPayment) - parseFloat(formData.separeAmount)))}
                                                    </span>
                                                </div>
                                                {parseFloat(formData.separeAmount) > parseFloat(formData.downPayment) && (
                                                    <div style={{
                                                        marginTop: 'var(--spacing-2)',
                                                        color: 'var(--color-error)',
                                                        fontSize: 'var(--font-size-xs)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <FiAlertTriangle size={12} />
                                                        El separe no puede ser mayor a la cuota inicial
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {formData.paymentType === 'installments' && selectedLots.length > 0 && (
                                <div style={{
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 'var(--spacing-4)',
                                    marginTop: 'var(--spacing-4)'
                                }}>
                                    {selectedLots.length === 1 ? (
                                        <>
                                            <div className="flex-between mb-2">
                                                <span style={{ color: 'var(--text-muted)' }}>Cuota Inicial:</span>
                                                <span style={{ fontWeight: '500' }}>{formatCurrency(formData.downPayment || 0)}</span>
                                            </div>
                                            <div className="flex-between mb-2">
                                                <span style={{ color: 'var(--text-muted)' }}>Saldo a financiar:</span>
                                                <span style={{ fontWeight: '500' }}>
                                                    {formatCurrency((parseFloat(selectedLots[0].salePrice) || 0) - (parseFloat(formData.downPayment) || 0))}
                                                </span>
                                            </div>
                                            <div className="flex-between">
                                                <span style={{ color: 'var(--text-muted)' }}>Valor por cuota:</span>
                                                <span style={{ fontWeight: '600', color: 'var(--color-primary-400)' }}>
                                                    {formatCurrency(calculateInstallment(selectedLots[0].salePrice))}
                                                </span>
                                            </div>
                                            {/* Ítem 9: mostrar ajuste de última cuota */}
                                            {(() => {
                                                const adj = lastInstallmentAdjust(selectedLots[0].salePrice);
                                                if (adj === 0) return null;
                                                const lastCuota = calculateInstallment(selectedLots[0].salePrice) + adj;
                                                return (
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                                                        Última cuota: {formatCurrency(lastCuota)}
                                                        {' '}({adj > 0 ? '+' : ''}{formatCurrency(adj)} ajuste de redondeo)
                                                    </div>
                                                );
                                            })()}
                                        </>
                                    ) : (
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                            <FiAlertTriangle style={{ marginRight: '4px' }} />
                                            Cada lote tendrá su propio plan de cuotas con la misma cuota inicial y número de cuotas.
                                        </div>
                                    )}

                                    {/* Custom Plan Toggle */}
                                    {(selectedLots.length === 1 || saleMode === 'grouped') && (
                                        <div style={{ marginTop: 'var(--spacing-3)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--spacing-3)' }}>
                                            <label className="form-checkbox-group">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.useCustomPlan}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, useCustomPlan: e.target.checked }))}
                                                />
                                                <span style={{ fontWeight: '500' }}>Personalizar plan de pagos (Cuotas variables)</span>
                                            </label>
                                            
                                            {formData.useCustomPlan && (
                                                <div style={{ marginTop: 'var(--spacing-3)' }}>
                                                    <div className="flex-between mb-2">
                                                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>Detalle de Cuotas</span>
                                                        <button type="button" className="btn btn-secondary btn-sm" onClick={handleGenerateCustomPlan}>
                                                            Auto-generar Base
                                                        </button>
                                                    </div>
                                                    {formData.customPlan.length > 0 ? (
                                                        <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                                                            <table className="table" style={{ margin: 0, fontSize: '0.85rem' }}>
                                                                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-tertiary)', zIndex: 1 }}>
                                                                    <tr>
                                                                        <th style={{ width: '80px' }}>No.</th>
                                                                        <th>Fecha</th>
                                                                        <th>Valor</th>
                                                                        <th style={{ width: '50px' }}></th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {formData.customPlan.map((inst, idx) => (
                                                                        <tr key={inst.id}>
                                                                            <td style={{ padding: '8px' }}>
                                                                                {inst.installmentNumber <= 0 ? (inst.installmentNumber === -1 ? 'Separe' : 'Inicial') : inst.installmentNumber}
                                                                            </td>
                                                                            <td style={{ padding: '8px' }}>
                                                                                <input type="date" className="form-input" style={{ padding: '4px 8px', fontSize: '0.85rem' }} value={inst.dueDate} onChange={(e) => handleCustomPlanChange(idx, 'dueDate', e.target.value)} />
                                                                            </td>
                                                                            <td style={{ padding: '8px' }}>
                                                                                <input type="number" className="form-input" style={{ padding: '4px 8px', fontSize: '0.85rem' }} value={inst.amount} onChange={(e) => handleCustomPlanChange(idx, 'amount', e.target.value)} />
                                                                            </td>
                                                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                                                <button type="button" onClick={() => removeCustomInstallment(idx)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer' }}>
                                                                                    <FiTrash2 />
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                                <tfoot style={{ position: 'sticky', bottom: 0, background: 'var(--bg-tertiary)' }}>
                                                                    <tr>
                                                                        <td colSpan="2" style={{ textAlign: 'right', fontWeight: '600', padding: '8px' }}>TOTAL:</td>
                                                                        <td colSpan="2" style={{ fontWeight: '700', padding: '8px', color: Math.abs(customPlanTotal - grandTotal) <= 1 ? 'var(--color-success)' : 'var(--color-error)' }}>
                                                                            {formatCurrency(customPlanTotal)} / {formatCurrency(grandTotal)}
                                                                        </td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <div className="empty-state" style={{ padding: 'var(--spacing-4)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)' }}>
                                                            <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>Haz clic en "Auto-generar Base" para iniciar, o añade cuotas manualmente.</p>
                                                        </div>
                                                    )}
                                                    <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={addCustomInstallment} style={{ width: '100%', justifyContent: 'center' }}>
                                                        <FiPlus /> Añadir Cuota
                                                    </button>
                                                    {errors.customPlan && <span className="form-error mt-2" style={{ display: 'block' }}>{errors.customPlan}</span>}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Acometida Section */}
                            {selectedLots.length > 0 && (
                                <div className="form-group mt-4" style={{
                                    background: 'rgba(59, 130, 246, 0.08)',
                                    border: '1px solid rgba(59, 130, 246, 0.25)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 'var(--spacing-4)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: formData.includeAcometida ? 'var(--spacing-3)' : '0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: '#3b82f6' }}>
                                            ¿Incluir Acometida?
                                        </div>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={formData.includeAcometida}
                                                onChange={(e) => setFormData(prev => ({ ...prev, includeAcometida: e.target.checked }))}
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                    {formData.includeAcometida && (
                                        <div className="form-row mt-2">
                                            <div className="form-group mb-0">
                                                <label className="form-label required">Valor Acometida</label>
                                                <CurrencyInput
                                                    className="form-input"
                                                    placeholder="Ej: 800000"
                                                    value={formData.acometidaValue}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, acometidaValue: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group mb-0" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                <label className="form-checkbox-group" style={{ marginTop: '24px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.acometidaPaid}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, acometidaPaid: e.target.checked }))}
                                                    />
                                                    <span style={{ fontWeight: '500' }}>¿Acometida pagada hoy?</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Commission Agent */}
                            <div className="form-group mt-4">
                                <label className="form-label">Comisionista</label>
                                <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                                    <select
                                        className="form-select"
                                        value={formData.commissionAgentId}
                                        onChange={(e) => {
                                            const agentId = e.target.value;
                                            const agent = commissionAgents.find(a => a.id === agentId);
                                            setFormData(prev => ({
                                                ...prev,
                                                commissionAgentId: agentId,
                                                commissionAgent: agent?.name || '',
                                                commissionAmount: agentId ? prev.commissionAmount : ''
                                            }));
                                        }}
                                        style={{ flex: 1 }}
                                    >
                                        <option value="">Sin comisionista</option>
                                        {commissionAgents.map(agent => (
                                            <option key={agent.id} value={agent.id}>
                                                {agent.name}{agent.phone ? ` - ${agent.phone}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setShowNewAgent(true)}
                                        title="Crear nuevo comisionista"
                                        style={{ whiteSpace: 'nowrap' }}
                                    >
                                        <FiUserPlus /> Nuevo
                                    </button>
                                </div>
                            </div>

                            {/* Commission Amount - only shown when agent is selected */}
                            {formData.commissionAgentId && (
                                <div className="form-group">
                                    <label className="form-label">
                                        <FiDollarSign style={{ marginRight: '4px' }} />
                                        Valor de la Comisión
                                    </label>
                                    <CurrencyInput
                                        className="form-input"
                                        placeholder="Ej: 500000"
                                        value={formData.commissionAmount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, commissionAmount: e.target.value }))}
                                    />
                                    {formData.commissionAmount && (
                                        <span className="form-hint" style={{ color: 'var(--color-primary-400)' }}>
                                            Comisión: {formatCurrency(formData.commissionAmount)}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Modal: Create New Commission Agent */}
                            {showNewAgent && (
                                <div className="modal-overlay" style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: 'rgba(0,0,0,0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 1000
                                }}>
                                    <div className="card" style={{
                                        width: '100%',
                                        maxWidth: '450px',
                                        margin: 'var(--spacing-4)',
                                        animation: 'fadeIn 0.2s ease'
                                    }}>
                                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 className="card-title" style={{ margin: 0 }}>
                                                <FiUserPlus className="card-title-icon" /> Nuevo Comisionista
                                            </h3>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => { setShowNewAgent(false); setNewAgent({ name: '', phone: '', document: '' }); }}
                                            >
                                                <FiX />
                                            </button>
                                        </div>
                                        <div className="card-body">
                                            <div className="form-group">
                                                <label className="form-label required">Nombre Completo</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="Ej: Juan Pérez"
                                                    value={newAgent.name}
                                                    onChange={(e) => setNewAgent(prev => ({ ...prev, name: e.target.value }))}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Teléfono</label>
                                                <input
                                                    type="tel"
                                                    className="form-input"
                                                    placeholder="Ej: 300 123 4567"
                                                    value={newAgent.phone}
                                                    onChange={(e) => setNewAgent(prev => ({ ...prev, phone: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Documento</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="Cédula o NIT"
                                                    value={newAgent.document}
                                                    onChange={(e) => setNewAgent(prev => ({ ...prev, document: e.target.value }))}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost"
                                                    onClick={() => { setShowNewAgent(false); setNewAgent({ name: '', phone: '', document: '' }); }}
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    onClick={handleCreateAgent}
                                                    disabled={!newAgent.name.trim() || creatingAgent}
                                                >
                                                    {creatingAgent ? 'Creando...' : 'Crear Comisionista'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="form-group mt-4">
                                <label className="form-label">Notas</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Notas adicionales sobre la venta..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    style={{ minHeight: '80px' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Client Selection */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">
                                <FiUser className="card-title-icon" />
                                Cliente
                            </h3>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                    setShowNewClient(!showNewClient);
                                    if (!showNewClient) {
                                        setFormData(prev => ({ ...prev, clientId: '' }));
                                    }
                                }}
                            >
                                {showNewClient ? 'Seleccionar Existente' : <><FiPlus /> Nuevo Cliente</>}
                            </button>
                        </div>
                        <div className="card-body">
                            {!showNewClient ? (
                                <>
                                    <div className="form-group">
                                        <label className="form-label required">Seleccionar Cliente</label>
                                        <select
                                            className={`form-select ${errors.clientId ? 'error' : ''}`}
                                            value={formData.clientId}
                                            onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
                                        >
                                            <option value="">Selecciona un cliente</option>
                                            {state.clients.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name || c.fullName} - {c.document}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.clientId && <span className="form-error">{errors.clientId}</span>}
                                    </div>

                                    {formData.clientId && (
                                        <div style={{
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-lg)',
                                            padding: 'var(--spacing-4)',
                                            marginTop: 'var(--spacing-4)'
                                        }}>
                                            {(() => {
                                                const client = state.clients.find(c => c.id === formData.clientId);
                                                return client ? (
                                                    <>
                                                        <div style={{ fontWeight: '600', marginBottom: 'var(--spacing-2)' }}>
                                                            {client.name || client.fullName}
                                                        </div>
                                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                                            {client.document}
                                                        </div>
                                                        {client.phone && (
                                                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                                                Tel: {client.phone}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : null;
                                            })()}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="form-group">
                                        <label className="form-label required">Nombre Completo</label>
                                        <input
                                            type="text"
                                            className={`form-input ${errors.newClientName ? 'error' : ''}`}
                                            placeholder="Juan Carlos Pérez"
                                            value={newClient.fullName}
                                            onChange={(e) => setNewClient(prev => ({ ...prev, fullName: e.target.value }))}
                                        />
                                        {errors.newClientName && <span className="form-error">{errors.newClientName}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label required">Documento</label>
                                        <input
                                            type="text"
                                            className={`form-input ${errors.newClientDocument ? 'error' : ''}`}
                                            placeholder="CC 1234567890"
                                            value={newClient.document}
                                            onChange={(e) => setNewClient(prev => ({ ...prev, document: e.target.value }))}
                                        />
                                        {errors.newClientDocument && <span className="form-error">{errors.newClientDocument}</span>}
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Teléfono</label>
                                            <input
                                                type="tel"
                                                className="form-input"
                                                placeholder="300 123 4567"
                                                value={newClient.phone}
                                                onChange={(e) => setNewClient(prev => ({ ...prev, phone: e.target.value }))}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Email</label>
                                            <input
                                                type="email"
                                                className="form-input"
                                                placeholder="cliente@email.com"
                                                value={newClient.email}
                                                onChange={(e) => setNewClient(prev => ({ ...prev, email: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Dirección</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Calle 123 # 45-67"
                                            value={newClient.address}
                                            onChange={(e) => setNewClient(prev => ({ ...prev, address: e.target.value }))}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Summary and Submit */}
                <div className="card mt-6">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiDollarSign className="card-title-icon" />
                            Resumen de la Venta
                        </h3>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-4" style={{ gap: 'var(--spacing-4)' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Proyecto</div>
                                <div style={{ fontWeight: '600' }}>
                                    {currentProject?.name || '-'}
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                    {selectedLots.length > 1 ? 'Lotes' : 'Lote'}
                                </div>
                                <div style={{ fontWeight: '600' }}>
                                    {selectedLots.length > 0
                                        ? selectedLots.map(l => `#${l.lotNumber}`).join(', ')
                                        : '-'
                                    }
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Cliente</div>
                                <div style={{ fontWeight: '600' }}>
                                    {showNewClient
                                        ? (newClient.fullName || '-')
                                        : ((state.clients.find(c => c.id === formData.clientId)?.name || state.clients.find(c => c.id === formData.clientId)?.fullName) || '-')
                                    }
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                    Precio Lote(s)
                                    {hasDiscount && <span style={{ color: '#f59e0b' }}> (con descuento)</span>}
                                </div>
                                <div style={{ fontWeight: '700', fontSize: 'var(--font-size-xl)', color: 'var(--color-primary-400)' }}>
                                    {formatCurrency(grandTotal)}
                                </div>
                            </div>
                        </div>

                        {/* Acometida + Total combinado */}
                        {formData.includeAcometida && parseFloat(formData.acometidaValue) > 0 && (
                            <div style={{ marginTop: '12px', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
                                    <span>Precio Lote(s)</span>
                                    <span>{formatCurrency(grandTotal)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#f59e0b' }}>
                                    <span>+ Acometida {formData.acometidaPaid ? '(ya pagada)' : '(por cobrar)'}</span>
                                    <span>{formatCurrency(parseFloat(formData.acometidaValue))}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '15px', color: 'var(--color-primary-400)', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '2px' }}>
                                    <span>Total a Cobrar</span>
                                    <span>{formatCurrency(grandTotal + parseFloat(formData.acometidaValue))}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="card-footer">
                        <Link to="/sales" className="btn btn-secondary">
                            Cancelar
                        </Link>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            <FiSave />
                            {isSubmitting
                                ? 'Registrando...'
                                : selectedLots.length > 1
                                    ? `Registrar ${selectedLots.length} Ventas`
                                    : 'Registrar Venta'
                            }
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

export default SaleForm;
