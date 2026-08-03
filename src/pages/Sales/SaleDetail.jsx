import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    FiArrowLeft,
    FiDollarSign,
    FiUser,
    FiMapPin,
    FiCalendar,
    FiFileText,
    FiPlus,
    FiTrash2,
    FiDownload,
    FiPrinter,
    FiImage,
    FiAlertTriangle,
    FiCheckCircle,
    FiChevronDown
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { generatePaymentSlipHTML, generatePaymentReceiptHTML, generateAccountStatementHTML, generateGlobalAccountStatementHTML, printDocument, resolveImageUrl } from '../../lib/barcodeUtils';
import { formatCurrency, formatDateLong as formatDate } from '../../lib/formatters';
import { getLotLabel } from '../../lib/lotLabel';
import { brand } from '../../config/brandConfig';
import { generateContractPDF } from '../../lib/contractPdfGenerator';
import { FiEdit } from 'react-icons/fi';
import { generateContractDocx, generateArrasDocx, generateConstanciaComisionDocx, generatePazYSalvoDocx, generateConstanciaCuotaInicialDocx, generateAbonoACuotaDocx } from '../../lib/contractDocxGenerator';
import { contractParamsService } from '../../services/contractParamsService';
import ConfirmModal from '../../components/ui/ConfirmModal';
import CurrencyInput from '../../components/ui/CurrencyInput';

function SaleDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const {
        getSaleById,
        deleteSale,
        addDesistimiento,
        getClientById,
        getProjectById,
        getPaymentsBySale,
        getTotalPaidBySale,
        getPendingAmount,
        getPendingInstallmentsBySale,
        getAllInstallmentsBySale,
        updatePayment,
        updateSale,
        state
    } = useApp();
    const { isAdmin, isSeller, isTreasurer, currentUser } = useAuth();
    const canDeleteSale = isAdmin();
    const canEditSale = isAdmin() || isTreasurer();

    const sale = getSaleById(id);
    const isSalePaid = sale ? parseFloat(sale.totalPaid || 0) >= parseFloat(sale.totalPrice || 0) : false;
    const client = sale ? getClientById(sale.clientId) : null;
    const project = sale ? getProjectById(sale.projectId) : null;
    const payments = sale ? getPaymentsBySale(id) : [];
    const totalPaid = sale ? getTotalPaidBySale(id) : 0;
    const pendingAmount = sale ? getPendingAmount(id) : 0;

    const [showContractModal, setShowContractModal] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [isGeneratingContract, setIsGeneratingContract] = useState(false);
    const [generatingDocType, setGeneratingDocType] = useState(null);
    const [showDocxMenu, setShowDocxMenu] = useState(false);
    const [showSepareModal, setShowSepareModal] = useState(false);
    const [separeSettings, setSepareSettings] = useState({ 
        amount: '', 
        date: new Date().toISOString().split('T')[0] 
    });
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    // Desistimiento state
    const [showDesistimientoModal, setShowDesistimientoModal] = useState(false);
    const [isProcessingDesistimiento, setIsProcessingDesistimiento] = useState(false);
    const [desistimientoData, setDesistimientoData] = useState({
        amount_retained: '',
        desistimiento_date: new Date().toISOString().split('T')[0],
        reason: '',
        notes: ''
    });

    // Edit Payment state
    const [editPaymentData, setEditPaymentData] = useState(null);
    const [isProcessingEditPayment, setIsProcessingEditPayment] = useState(false);

    // Edit Sale state
    const [editSaleData, setEditSaleData] = useState(null);
    const [isProcessingEditSale, setIsProcessingEditSale] = useState(false);

    if (state.isLoading) {
        return (
            <div className="card">
                <div className="empty-state" style={{ padding: '3rem' }}>
                    <div className="spinner"></div>
                    <h3 style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Cargando datos de la venta...</h3>
                </div>
            </div>
        );
    }

    if (!sale) {
        return (
            <div className="card">
                <div className="empty-state">
                    <h3>Venta no encontrada</h3>
                    <p>La venta que buscas no existe o fue eliminada</p>
                    <Link to="/sales" className="btn btn-primary">
                        <FiArrowLeft /> Volver a Ventas
                    </Link>
                </div>
            </div>
        );
    }

    const handleDelete = () => {
        setShowConfirmDelete(true);
    };

    const executeDelete = async () => {
        const result = await deleteSale(id);
        if (result && result.success === false) {
            alert('Error al eliminar la venta: ' + (result.error || 'Error desconocido'));
            return;
        }
        navigate('/sales');
    };

    // Abre el modal de desistimiento pre-llenando el monto con el total pagado
    const handleOpenDesistimiento = () => {
        setDesistimientoData(prev => ({
            ...prev,
            amount_retained: totalPaid > 0 ? String(totalPaid) : ''
        }));
        setShowDesistimientoModal(true);
    };

    // Procesa el desistimiento
    const handleConfirmDesistimiento = async () => {
        setIsProcessingDesistimiento(true);
        try {
            const payload = {
                sale_id: id,
                amount_retained: parseFloat(desistimientoData.amount_retained || 0),
                desistimiento_date: desistimientoData.desistimiento_date,
                reason: desistimientoData.reason || null,
                notes: desistimientoData.notes || null,
            };
            const result = await addDesistimiento(payload);
            if (result) {
                setShowDesistimientoModal(false);
                navigate('/desistimientos');
            } else {
                alert('Error al registrar el desistimiento. Intenta de nuevo.');
            }
        } catch (err) {
            console.error('Error en desistimiento:', err);
            alert('Error inesperado. Revisa la consola.');
        } finally {
            setIsProcessingDesistimiento(false);
        }
    };

    // Abre el modal para editar pago
    const handleOpenEditPayment = (payment) => {
        setEditPaymentData({
            id: payment.id,
            sale_id: payment.saleId || payment.sale_id,
            amount: payment.amount,
            payment_date: payment.paymentDate || payment.payment_date || new Date().toISOString().split('T')[0],
            payment_method: payment.paymentMethod || payment.payment_method || 'cash',
            bank_account_id: payment.bankAccountId || payment.bank_account_id || '',
            receipt_image: payment.receiptImage || payment.receipt_image || '', // preserve existing image
            notes: payment.notes || ''
        });
    };

    const handleConfirmEditPayment = async () => {
        setIsProcessingEditPayment(true);
        try {
            const payload = {
                id: editPaymentData.id,
                sale_id: editPaymentData.sale_id,
                amount: parseFloat(editPaymentData.amount || 0),
                payment_date: editPaymentData.payment_date,
                payment_method: editPaymentData.payment_method,
                bank_account_id: editPaymentData.bank_account_id,
                // Preserve existing image — only send if it has a value
                ...(editPaymentData.receipt_image ? { receipt_image: editPaymentData.receipt_image } : {}),
                notes: editPaymentData.notes || ''
            };
            await updatePayment(payload);
            setEditPaymentData(null);
        } catch (err) {
            console.error("Error al editar pago:", err);
            alert("Error al editar el pago");
        } finally {
            setIsProcessingEditPayment(false);
        }
    };

    // Abre el modal para editar Venta
    const handleOpenEditSale = () => {
        setEditSaleData({
            id: sale.id,
            totalPrice: sale.totalPrice,
            saleDate: sale.saleDate || new Date().toISOString().split('T')[0],
            paymentType: sale.paymentType,
            downPayment: sale.downPayment,
            numberOfInstallments: sale.numberOfInstallments,
            notes: sale.notes || ''
        });
    };

    const handleConfirmEditSale = async () => {
        setIsProcessingEditSale(true);
        try {
            const payload = {
                id: editSaleData.id,
                totalPrice: parseFloat(editSaleData.totalPrice || 0),
                saleDate: editSaleData.saleDate,
                paymentType: editSaleData.paymentType,
                downPayment: parseFloat(editSaleData.downPayment || 0),
                numberOfInstallments: parseInt(editSaleData.numberOfInstallments || 1),
                notes: editSaleData.notes || ''
            };
            const result = await updateSale(payload);
            if (result && result.error) {
                alert("Error al editar la venta: " + result.error);
            } else {
                setEditSaleData(null);
            }
        } catch (err) {
            console.error("Error al editar venta:", err);
            alert("Error al editar la venta");
        } finally {
            setIsProcessingEditSale(false);
        }
    };

    const progressPercentage = (totalPaid / parseFloat(sale.totalPrice)) * 100;
    const isPaid = pendingAmount <= 0;

    const handleGenerateContract = async () => {
        setIsGeneratingContract(true);
        try {
            let contractParams = {};
            try {
                const { data: paramsRes } = await contractParamsService.getParams();
                contractParams = paramsRes?.data || paramsRes || {};
            } catch (err) {
                console.warn("Fallo al cargar contract params (CORS/API error). Usando valores por defecto.", err);
            }

            contractParams.separeAmount = separeSettings.amount ? parseFloat(separeSettings.amount) : 0;
            contractParams.separeDate = separeSettings.date;

            let promesaNumber = 1;
            try {
                const { data: promRes } = await contractParamsService.getNextPromesa();
                promesaNumber = promRes?.data?.numero_promesa || 1;
            } catch (err) {
                console.warn("Fallo al obtener numero de promesa. Usando 1 por defecto.", err);
            }

            const lot = project?.lots?.find(l => l.id === sale.lotId);
            // Ítem 8: Para ventas grupadas, resolver todos los lotes del sale_lots
            const saleLotRefs = sale.sale_lots || [];
            const lots = saleLotRefs.length > 1
                ? saleLotRefs.map(sl => project?.lots?.find(l => l.id === sl.lot_id) || { area: sl.area || 0 })
                : (lot ? [lot] : []);

            generateContractPDF({
                sale,
                client,
                project,
                lot,
                lots,
                contractParams,
                promesaNumber
            });
            setShowSepareModal(false);
        } catch (err) {
            console.error('Error generating contract:', err);
            alert('Error al generar el contrato. Verifica que los parámetros de contrato estén configurados.');
        } finally {
            setIsGeneratingContract(false);
        }
    };

    const handleGenerateSpecificDocx = async (type) => {
        setGeneratingDocType(type);
        setShowDocxMenu(false);
        try {
            const lot = project?.lots?.find(l => l.id === sale.lotId);

            // Cargar contractParams para todos los tipos de documento
            let contractParams = {};
            try {
                const { data: paramsRes } = await contractParamsService.getParams();
                contractParams = paramsRes?.data || paramsRes || {};
            } catch (err) {
                console.warn('No se pudieron cargar los parámetros de contrato:', err);
            }

            if (type === 'contrato') {
                contractParams.separeAmount = separeSettings.amount ? parseFloat(separeSettings.amount) : 0;
                contractParams.separeDate = separeSettings.date;
                let promesaNumber = 1;
                try {
                    const { data: promRes } = await contractParamsService.getNextPromesa();
                    promesaNumber = promRes?.data?.numero_promesa || 1;
                } catch (err) {}
                await generateContractDocx({ sale, client, project, lot, contractParams, promesaNumber });
            } else if (type === 'arras') {
                await generateArrasDocx(sale, project, lot, client, sale.acometidaValue || sale.acometida_value || 8700000, contractParams);
            } else if (type === 'comision') {
                await generateConstanciaComisionDocx(sale, project, lot, client, sale.commissionAmount || sale.commission_amount || 5000000, sale.commissionAgent || sale.commission_agent || '', contractParams);
            } else if (type === 'pazysalvo') {
                await generatePazYSalvoDocx(sale, project, lot, client, contractParams);
            } else if (type === 'cuotaInicial') {
                await generateConstanciaCuotaInicialDocx(sale, project, lot, client, sale.downPayment || sale.down_payment, contractParams);
            } else if (type === 'abonoACuota') {
                const lastPayment = payments?.[payments.length - 1] || {};
                const label = lastPayment.notes || 'Abono a cuota';
                await generateAbonoACuotaDocx(sale, project, lot, client, lastPayment, label, contractParams);
            }
        } catch (err) {
            console.error('Error generating docx:', err);
            alert('Error al generar el documento Word.');
        } finally {
            setGeneratingDocType(null);
        }
    };


    const generateInvoiceHTML = () => {
        const lot = project?.lots?.find(l => l.id === sale.lotId);
        const invoiceNumber = `FAC-${sale.id?.substring(0, 8).toUpperCase() || '000000'}`;

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Factura ${invoiceNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
        .invoice-container { max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 3px solid #2d6a4f; padding-bottom: 20px; }
        .logo { font-size: 28px; font-weight: 700; color: #2d6a4f; }
        .invoice-info { text-align: right; }
        .invoice-number { font-size: 18px; font-weight: 600; color: #2d6a4f; }
        .invoice-date { color: #666; margin-top: 5px; }
        .section { margin-bottom: 30px; }
        .section-title { font-size: 14px; text-transform: uppercase; color: #2d6a4f; font-weight: 600; margin-bottom: 10px; letter-spacing: 1px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .info-box { background: #f8fafc; padding: 20px; border-radius: 8px; }
        .info-box h4 { font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 8px; }
        .info-box p { margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 12px; }
        .total-section { background: linear-gradient(135deg, #2d6a4f, #40916c); color: white; padding: 30px; border-radius: 8px; margin-top: 30px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .total-row.main { font-size: 24px; font-weight: 700; border-top: 2px solid rgba(255,255,255,0.3); padding-top: 15px; margin-top: 15px; }
        .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
        .status { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 12px; }
        .status.paid { background: #dcfce7; color: #166534; }
        .status.pending { background: #fef3c7; color: #92400e; }
        @media print { body { padding: 20px; } .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div>
                ${project?.logo_url || project?.logoUrl
                    ? `<div style="display:flex;align-items:center;gap:10px;"><img src="${resolveImageUrl(project.logo_url || project.logoUrl)}" style="max-height:50px;max-width:140px;object-fit:contain;" onerror="this.style.display='none'" /><div><div class="logo">${project?.name || brand.appName}</div><p style="color: #666; margin-top: 5px;">${brand.subtitle}</p></div></div>`
                    : `<div class="logo">${brand.emoji} ${brand.appName}</div><p style="color: #666; margin-top: 5px;">${brand.subtitle}</p>`
                }
            </div>
            <div class="invoice-info">
                <div class="invoice-number">${invoiceNumber}</div>
                <div class="invoice-date">Fecha: ${formatDate(sale.saleDate || sale.createdAt)}</div>
                <div style="margin-top: 10px;">
                    <span class="status ${isPaid ? 'paid' : 'pending'}">${isPaid ? '✓ PAGADO' : '⏳ PENDIENTE'}</span>
                </div>
            </div>
        </div>

        <div class="info-grid">
            <div class="info-box">
                <h4>Vendedor</h4>
                <p><strong>${project?.name || 'Proyecto'}</strong></p>
                <p>${project?.location || ''}</p>
                ${project?.partners?.map(p => `<p>${p.name} (${p.percentage}%)</p>`).join('') || ''}
            </div>
            <div class="info-box">
                <h4>Comprador</h4>
                <p><strong>${client?.name || client?.fullName || 'Cliente'}</strong></p>
                <p>Doc: ${client?.document || 'N/A'}</p>
                <p>Tel: ${client?.phone || 'N/A'}</p>
                <p>${client?.address || ''}</p>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Detalle de la Venta</div>
            <table>
                <thead>
                    <tr>
                        <th>Descripción</th>
                        <th>Cantidad</th>
                        <th style="text-align: right;">Precio</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <strong>Lote ${sale.lotNumber}</strong><br>
                            <span style="color: #666; font-size: 13px;">
                                Proyecto: ${project?.name || 'N/A'} - ${project?.location || ''}<br>
                                ${sale.lotManzana ? `Manzana: ${sale.lotManzana}<br>` : ''}
                                ${sale.lotEtapaName ? `Etapa: ${sale.lotEtapaName}<br>` : ''}
                                ${lot?.area ? `Área: ${lot.area} m²` : ''}
                            </span>
                        </td>
                        <td>1</td>
                        <td style="text-align: right;">${formatCurrency(sale.totalPrice)}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="total-section">
            <div class="total-row">
                <span>Precio Total:</span>
                <span>${formatCurrency(sale.totalPrice)}</span>
            </div>
            <div class="total-row">
                <span>Cuota Inicial:</span>
                <span>${formatCurrency(sale.downPayment || 0)}</span>
            </div>
            <div class="total-row">
                <span>Total Pagado:</span>
                <span>${formatCurrency(totalPaid)}</span>
            </div>
            <div class="total-row main">
                <span>${isPaid ? 'SALDO' : 'SALDO PENDIENTE'}:</span>
                <span>${formatCurrency(pendingAmount > 0 ? pendingAmount : 0)}</span>
            </div>
        </div>

        <div class="section" style="margin-top: 30px;">
            <div class="section-title">Forma de Pago</div>
            <p style="padding: 15px; background: #f8fafc; border-radius: 8px;">
                ${sale.paymentType === 'cash' ? 'Pago de Contado' : `Financiado en ${sale.numberOfInstallments} cuotas`}
            </p>
        </div>

        <div class="footer">
            <p>Esta factura fue generada automáticamente por ${brand.appName}</p>
            <p style="margin-top: 5px;">Fecha de generación: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO')}</p>
        </div>
    </div>

    <script>
        window.onload = function() { window.print(); }
    </script>
</body>
</html>`;
    };

    const printInvoice = () => {
        const invoiceWindow = window.open('', '_blank');
        invoiceWindow.document.write(generateInvoiceHTML());
        invoiceWindow.document.close();
    };

    const handlePrintReceipt = async () => {
        let installments = [];
        try {
            // Obtener TODAS las cuotas (no solo pendientes) para mostrar el plan completo
            const { data } = await getAllInstallmentsBySale(id);
            if (data) installments = data;
        } catch (err) {
            console.error('Error loading installments:', err);
        }

        // Preguntar cuota específica solo si hay cuotas pendientes
        let selectedInstallment = null;
        const pendingInst = installments.filter(i => i.status !== 'paid');
        if (pendingInst.length > 0) {
            const options = pendingInst.map(inst => {
                const num = inst.installment_number ?? inst.installmentNumber;
                const label = num === -1 ? 'Sepáre' : num === 0 ? 'Cuota Inicial' : `Cuota No. ${num}`;
                const due = inst.due_date || inst.dueDate;
                return `${label} — ${formatCurrency(inst.amount)}${due ? ` (vence ${due})` : ''}`;
            });
            const choice = window.prompt(
                `¿Para qué cuota es este recibo?\n\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nIngrese el número (o Enter para recibo general):`,
                '1'
            );
            if (choice !== null && choice.trim() !== '') {
                const idx = parseInt(choice) - 1;
                if (idx >= 0 && idx < pendingInst.length) {
                    selectedInstallment = pendingInst[idx];
                }
            }
        }

        const html = generatePaymentSlipHTML({ sale, client, project, installments, currentUser, selectedInstallment });
        printDocument(html);
    };

    const handlePrintAccountStatement = async () => {
        let installments = [];
        try {
            const { data } = await getAllInstallmentsBySale(id);
            if (data) installments = data;
        } catch (err) {
            console.error('Error loading installments:', err);
        }
        const html = generateAccountStatementHTML({ sale, client, project, installments, payments, currentUser });
        printDocument(html);
    };

    const handlePrintGlobalAccountStatement = async () => {
        if (!client) return;
        const clientSales = state.sales.filter(s => s.clientId === client.id);
        const installmentsMap = {};
        for (const cs of clientSales) {
            try {
                const { data } = await getPendingInstallmentsBySale(cs.id);
                if (data) installmentsMap[cs.id] = data;
            } catch (err) { /* skip */ }
        }
        const allPayments = state.payments.filter(p => clientSales.some(s => s.id === p.saleId));
        const html = generateGlobalAccountStatementHTML({
            client, 
            sales: clientSales, 
            payments: allPayments, 
            projects: state.projects,
            installmentsMap,
            currentUser
        });
        printDocument(html);
    };

    const openReceiptModal = (receiptImage) => {
        setSelectedReceipt(receiptImage);
        setShowReceiptModal(true);
    };

    const handlePrintPaymentReceipt = (payment) => {
        // Calcular total pagado REAL desde el array de pagos (no desde sale.totalPaid que puede estar desactualizado)
        const paymentsBeforeThis = payments.filter(p => p.id !== payment.id);
        const totalPaidBefore = paymentsBeforeThis.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const saleWithRealTotal = {
            ...sale,
            totalPaid: totalPaidBefore  // total pagado ANTES de este pago
        };
        const html = generatePaymentReceiptHTML({
            payment,
            sale: saleWithRealTotal,
            client,
            project,
            currentUser,
            selectedInstallmentIds: null,
            installments: []
        });
        printDocument(html);
    };

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <Link to="/sales" className="btn btn-ghost btn-sm mb-2">
                        <FiArrowLeft /> Volver
                    </Link>
                    <h1>Venta - Lote {sale.lotNumber}</h1>
                    <p>{project?.name} • {formatDate(sale.createdAt)}</p>
                </div>
                <div className="page-header-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={handlePrintReceipt}
                        title="Reimprimir recibo de venta con código de barras"
                    >
                        <FiPrinter /> Recibo
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={printInvoice}
                    >
                        <FiPrinter /> Factura
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handlePrintAccountStatement}
                    >
                        <FiFileText /> Estado Cuenta
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handlePrintGlobalAccountStatement}
                        title="Estado de cuenta consolidado del cliente"
                    >
                        <FiFileText /> Estado Global
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowSepareModal(true)}
                        disabled={isGeneratingContract}
                    >
                        {isGeneratingContract ? (
                            <><span className="spinner" style={{ width: 14, height: 14 }}></span> Generando...</>
                        ) : (
                            <><FiFileText /> Generar Contrato PDF</>
                        )}
                    </button>
                    <div style={{ position: 'relative' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowDocxMenu(!showDocxMenu)}
                                disabled={generatingDocType !== null}
                                style={{ borderColor: '#2563eb', color: '#2563eb' }}
                            >
                                {generatingDocType !== null ? (
                                    <><span className="spinner" style={{ width: 14, height: 14 }}></span> Generando...</>
                                ) : (
                                    <><FiDownload /> Docs Word <FiChevronDown style={{ marginLeft: '4px' }} /></>
                                )}
                            </button>
                            {showDocxMenu && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '4px',
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    boxShadow: 'var(--shadow-lg)',
                                    zIndex: 10,
                                    minWidth: '220px',
                                    overflow: 'hidden'
                                }}>
                                    <button 
                                        onClick={() => handleGenerateSpecificDocx('contrato')}
                                        style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                    >
                                        📄 Contrato Principal
                                    </button>
                                    <button 
                                        onClick={() => handleGenerateSpecificDocx('arras')}
                                        style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                    >
                                        📄 Arras de Separación
                                    </button>
                                    <button 
                                        onClick={() => handleGenerateSpecificDocx('comision')}
                                        style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                    >
                                        📄 Constancia de Comisión
                                    </button>
                                    <button 
                                        onClick={() => handleGenerateSpecificDocx('pazysalvo')}
                                        style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                    >
                                        📄 Paz y Salvo
                                    </button>
                                    <button 
                                        onClick={() => handleGenerateSpecificDocx('cuotaInicial')}
                                        style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                    >
                                        📄 Constancia Cuota Inicial
                                    </button>
                                    <button 
                                        onClick={() => handleGenerateSpecificDocx('abonoACuota')}
                                        style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
                                    >
                                        📄 Abono a Cuota
                                    </button>
                                </div>
                            )}
                        </div>

                    {/* Solo mostrar "Registrar Pago" si la venta está activa */}
                    {sale.status !== 'desistida' && (
                        <Link to={`/payments/new?saleId=${id}`} className="btn btn-primary">
                            <FiPlus /> Registrar Pago
                        </Link>
                    )}
                    {canDeleteSale && sale.status !== 'desistida' && (
                        <>
                            {totalPaid > 0 && sale.status !== 'desistida' && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleOpenDesistimiento}
                                    style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#fff' }}
                                >
                                    <FiAlertTriangle /> Desistimiento
                                </button>
                            )}
                            {totalPaid <= 0 && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleDelete}
                                    style={{ color: '#ef4444' }}
                                >
                                    <FiTrash2 /> Eliminar Venta
                                </button>
                            )}
                            <button
                                className="btn btn-secondary"
                                onClick={handleOpenEditSale}
                                style={{ color: '#f59e0b' }}
                            >
                                <FiEdit /> Editar Venta
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ===== BANNER: VENTA DESISTIDA ===== */}
            {sale.status === 'desistida' && (
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.875rem',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem',
                }}>
                    <FiAlertTriangle style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} size={20} />
                    <div>
                        <strong style={{ color: '#f59e0b', fontSize: 'var(--font-size-base)' }}>Venta Desistida</strong>
                        <p style={{ margin: '2px 0 0 0', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                            Esta venta fue cancelada por desistimiento. El lote #{sale.lotNumber} quedó disponible.
                            El historial de pagos se conserva para auditoría.
                        </p>
                    </div>
                </div>
            )}

            {/* Progress Card */}
            <div className="card mb-6">
                <div className="card-body">
                    <div className="flex-between mb-4">
                        <div>
                            <h3 style={{ margin: 0 }}>Progreso de Pago</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                                {formatCurrency(totalPaid)} de {formatCurrency(sale.totalPrice)}
                            </p>
                        </div>
                        <span className={`badge ${isPaid ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 'var(--font-size-base)', padding: 'var(--spacing-2) var(--spacing-4)' }}>
                            {isPaid ? 'Pagado' : `Pendiente: ${formatCurrency(pendingAmount)}`}
                        </span>
                    </div>

                    <div style={{
                        height: '12px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-full)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${Math.min(progressPercentage, 100)}%`,
                            height: '100%',
                            background: isPaid
                                ? 'var(--color-success)'
                                : 'linear-gradient(90deg, var(--color-primary-500), var(--color-accent-500))',
                            borderRadius: 'var(--radius-full)',
                            transition: 'width var(--transition-slow)'
                        }} />
                    </div>

                    <div className="flex-between mt-2">
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                            {payments.length} pago{payments.length !== 1 ? 's' : ''} registrado{payments.length !== 1 ? 's' : ''}
                        </span>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>
                            {Math.round(progressPercentage)}%
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-2">
                {/* Sale Info */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiMapPin className="card-title-icon" />
                            {sale.saleLots?.length > 1 ? `Lotes (${sale.saleLots.length})` : 'Información del Lote'}
                        </h3>
                    </div>
                    <div className="card-body">
                        <div className="flex flex-col gap-4">
                            <div className="flex-between">
                                <span style={{ color: 'var(--text-muted)' }}>Proyecto:</span>
                                <Link to={`/projects/${sale.projectId}`} style={{ fontWeight: '500' }}>
                                    {project?.name || '-'}
                                </Link>
                            </div>
                            <div className="flex-between">
                                <span style={{ color: 'var(--text-muted)' }}>Ubicación:</span>
                                <span>{project?.location || '-'}</span>
                            </div>

                            {/* Multi-lot grouped sale: show all lots as a table */}
                            {sale.saleLots?.length > 1 ? (
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--spacing-2)' }}>
                                        Lotes incluidos en esta venta:
                                    </div>
                                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-tertiary)' }}>
                                                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600' }}>Lote</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: '600' }}>Área</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: '600' }}>Precio</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sale.saleLots.map((sl, idx) => (
                                                    <tr key={sl.id || idx} style={{ borderTop: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '8px 12px', fontWeight: '600' }}>#{sl.lot_number}</td>
                                                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                                            {sl.area ? `${sl.area} m²` : '-'}
                                                        </td>
                                                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-primary-400)', fontWeight: '600' }}>
                                                            {formatCurrency(sl.sale_price || sl.salePrice || 0)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-between">
                                    <span style={{ color: 'var(--text-muted)' }}>Lote:</span>
                                    <span style={{ fontWeight: '600' }}>#{sale.lotNumber}</span>
                                </div>
                            )}

                            <div className="flex-between">
                                <span style={{ color: 'var(--text-muted)' }}>Precio Total:</span>
                                <span style={{ fontWeight: '700', color: 'var(--color-primary-400)' }}>
                                    {formatCurrency(sale.totalPrice)}
                                </span>
                            </div>
                            <div className="flex-between">
                                <span style={{ color: 'var(--text-muted)' }}>Forma de Pago:</span>
                                <span>
                                    {sale.paymentType === 'cash' ? 'Contado' : `${sale.numberOfInstallments} cuotas`}
                                </span>
                            </div>
                            {sale.downPayment > 0 && (
                                <div className="flex-between">
                                    <span style={{ color: 'var(--text-muted)' }}>Cuota Inicial:</span>
                                    <span>{formatCurrency(sale.downPayment)}</span>
                                </div>
                            )}
                            <div className="flex-between">
                                <span style={{ color: 'var(--text-muted)' }}>Fecha de Venta:</span>
                                <span>
                                    <FiCalendar size={12} style={{ marginRight: '4px' }} />
                                    {formatDate(sale.saleDate || sale.createdAt)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Client Info */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FiUser className="card-title-icon" />
                            Cliente
                        </h3>
                        <Link to={`/clients/${sale.clientId}`} className="btn btn-ghost btn-sm">
                            Ver perfil
                        </Link>
                    </div>
                    <div className="card-body">
                        <div className="flex gap-4" style={{ alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
                            <div style={{
                                width: '50px',
                                height: '50px',
                                background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-accent-500))',
                                borderRadius: 'var(--radius-xl)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: 'var(--font-size-xl)'
                            }}>
                                {(client?.name || client?.fullName)?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div>
                                <div style={{ fontWeight: '600', fontSize: 'var(--font-size-lg)' }}>
                                    {client?.name || client?.fullName || '-'}
                                </div>
                                <div style={{ color: 'var(--text-muted)' }}>{client?.document || '-'}</div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2" style={{
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--spacing-4)'
                        }}>
                            {client?.phone && (
                                <div style={{ fontSize: 'var(--font-size-sm)' }}>📞 {client.phone}</div>
                            )}
                            {client?.email && (
                                <div style={{ fontSize: 'var(--font-size-sm)' }}>✉️ {client.email}</div>
                            )}
                            {client?.address && (
                                <div style={{ fontSize: 'var(--font-size-sm)' }}>📍 {client.address}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Payments History */}
            <div className="card mt-6">
                <div className="card-header">
                    <h3 className="card-title">
                        <FiDollarSign className="card-title-icon" />
                        Historial de Pagos
                    </h3>
                    {/* Solo mostrar botón de nuevo pago si la venta está activa */}
                    {sale.status !== 'desistida' && (
                        <Link to={`/payments/new?saleId=${id}`} className="btn btn-primary btn-sm">
                            <FiPlus /> Registrar Pago
                        </Link>
                    )}
                </div>
                <div className="card-body">
                    {payments.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--spacing-8)' }}>
                            <div className="empty-state-icon">
                                <FiDollarSign />
                            </div>
                            <h3>Sin pagos registrados</h3>
                            <p>Registra el primer pago de esta venta</p>
                            {sale.status !== 'desistida' && (
                                <Link to={`/payments/new?saleId=${id}`} className="btn btn-primary btn-sm">
                                    <FiPlus /> Registrar Pago
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Fecha</th>
                                        <th>Monto</th>
                                        <th>Método</th>
                                        <th>Recibo</th>
                                        <th>Notas</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((payment, index) => (
                                        <tr key={payment.id}>
                                            <td>{index + 1}</td>
                                            <td>
                                                <FiCalendar size={12} style={{ marginRight: '4px' }} />
                                                {formatDate(payment.paymentDate || payment.createdAt)}
                                            </td>
                                            <td style={{ fontWeight: '600', color: 'var(--color-success)' }}>
                                                {formatCurrency(payment.amount)}
                                            </td>
                                            <td>
                                                {(payment.paymentMethod || payment.payment_method) === 'transfer' ? (
                                                    <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                        🏦 Transferencia
                                                    </span>
                                                ) : (
                                                    <span className="badge" style={{ fontSize: 'var(--font-size-xs)', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                                        💵 Efectivo
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {payment.receiptImage ? (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => openReceiptModal(payment.receiptImage)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <FiImage /> Ver recibo
                                                    </button>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                )}
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {payment.notes || '-'}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handlePrintPaymentReceipt(payment)}
                                                        title="Imprimir comprobante"
                                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                                                    >
                                                        <FiPrinter size={13} /> Imprimir
                                                    </button>
                                                    {(canDeleteSale) && (
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => handleOpenEditPayment(payment)}
                                                            title="Editar pago"
                                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', color: '#f59e0b' }}
                                                        >
                                                            <FiEdit size={13} /> Editar
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Zona de peligro: solo visible si la venta está activa */}
            {canDeleteSale && sale.status !== 'desistida' && (
                <div className="card mt-6" style={{ borderColor: 'var(--color-error)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <div className="card-body">
                        <div className="flex-between">
                            <div>
                                <h4 style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-1)' }}>Eliminar Venta</h4>
                                <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                                    Esta acción eliminará la venta y marcará el lote como disponible. Los pagos asociados también serán eliminados.
                                </p>
                                {totalPaid > 0 && (
                                    <p style={{ margin: '8px 0 0 0', color: '#f59e0b', fontWeight: '600', fontSize: 'var(--font-size-sm)' }}>
                                        ⚠️ Esta venta tiene {formatCurrency(totalPaid)} en pagos registrados. Al eliminarla se perderán esos registros.
                                    </p>
                                )}
                            </div>
                            <button className="btn btn-danger" onClick={handleDelete}>
                                <FiTrash2 /> Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Receipt Image Modal */}
            {showReceiptModal && selectedReceipt && (
                <div className="modal-overlay" onClick={() => setShowReceiptModal(false)}>
                    <div
                        className="modal modal-lg"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '90vw', maxHeight: '90vh' }}
                    >
                        <div className="modal-header">
                            <h3 className="modal-title">
                                <FiImage style={{ marginRight: '8px' }} />
                                Recibo de Pago
                            </h3>
                            <button className="modal-close" onClick={() => setShowReceiptModal(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            background: 'var(--bg-tertiary)',
                            padding: 'var(--spacing-4)',
                            maxHeight: '70vh',
                            overflow: 'auto'
                        }}>
                            <img
                                src={resolveImageUrl(selectedReceipt)}
                                alt="Recibo de pago"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    borderRadius: 'var(--radius-lg)',
                                    boxShadow: 'var(--shadow-lg)'
                                }}
                            />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowReceiptModal(false)}>
                                Cerrar
                            </button>
                            <a
                                href={resolveImageUrl(selectedReceipt)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary"
                            >
                                <FiDownload /> Abrir en nueva pestaña
                            </a>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={showConfirmDelete}
                title="¿Eliminar esta venta?"
                message="El lote volverá a estar disponible. Esta acción no se puede deshacer."
                confirmText="Eliminar"
                variant="danger"
                onConfirm={executeDelete}
                onCancel={() => setShowConfirmDelete(false)}
            />

            {/* ===== MODAL DESISTIMIENTO ===== */}
            {showDesistimientoModal && (
                <div className="modal-overlay" onClick={() => !isProcessingDesistimiento && setShowDesistimientoModal(false)}>
                    <div
                        className="modal modal-lg"
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: '520px' }}
                    >
                        <div className="modal-header" style={{ borderBottom: '2px solid #f59e0b' }}>
                            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiAlertTriangle style={{ color: '#f59e0b' }} />
                                Registrar Desistimiento
                            </h3>
                            <button className="modal-close" onClick={() => setShowDesistimientoModal(false)} disabled={isProcessingDesistimiento}>×</button>
                        </div>

                        <div className="modal-body">
                            {/* Info del lote */}
                            <div style={{
                                background: 'rgba(245, 158, 11, 0.08)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--spacing-4)',
                                marginBottom: 'var(--spacing-5)'
                            }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: 'var(--font-size-sm)' }}>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>Cliente:</span>{' '}
                                        <strong>{client?.name || client?.fullName || '-'}</strong>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>Lote:</span>{' '}
                                        <strong>#{sale.lotNumber}</strong>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>Precio venta:</span>{' '}
                                        <strong>{formatCurrency(sale.totalPrice)}</strong>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>Total pagado:</span>{' '}
                                        <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(totalPaid)}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Monto Retenido por la Empresa ($) <span style={{ color: '#ef4444' }}>*</span></label>
                                <CurrencyInput
                                    className="form-control"
                                    placeholder={`Máximo: ${totalPaid}`}
                                    value={desistimientoData.amount_retained}
                                    onChange={e => setDesistimientoData(prev => ({ ...prev, amount_retained: e.target.value }))}
                                />
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Puede ser el total pagado o una penalización acordada. Por defecto se sugiere el total pagado.
                                </p>
                            </div>

                            {/* Resumen financiero en tiempo real */}
                            {totalPaid > 0 && (() => {
                                const retained = parseFloat(desistimientoData.amount_retained) || 0;
                                const refund = Math.max(0, totalPaid - retained);
                                return (
                                    <div style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: '1rem',
                                        marginBottom: 'var(--spacing-4)',
                                        fontSize: 'var(--font-size-sm)',
                                    }}>
                                        <p style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                            Resumen de la Devolución
                                        </p>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Total recibido del cliente:</span>
                                            <span style={{ fontWeight: '600' }}>{formatCurrency(totalPaid)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Retiene la empresa:</span>
                                            <span style={{ fontWeight: '600', color: 'var(--color-success)' }}>- {formatCurrency(retained)}</span>
                                        </div>
                                        <div style={{
                                            display: 'flex', justifyContent: 'space-between',
                                            borderTop: '1px solid var(--border-color)',
                                            paddingTop: '6px', marginTop: '6px'
                                        }}>
                                            <span style={{ fontWeight: '700' }}>Devolver al cliente:</span>
                                            <span style={{ fontWeight: '700', color: refund > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                                                {formatCurrency(refund)}
                                            </span>
                                        </div>
                                        {refund > 0 && (
                                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '6px', marginBottom: 0 }}>
                                                💡 Se registrará automáticamente un <strong>Gasto</strong> por {formatCurrency(refund)} en la categoría "Devolución Desistimiento".
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}

                            <div className="form-group">
                                <label className="form-label">Fecha del Desistimiento</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={desistimientoData.desistimiento_date}
                                    onChange={e => setDesistimientoData(prev => ({ ...prev, desistimiento_date: e.target.value }))}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Motivo del Desistimiento</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Ej: Dificultades económicas, cambio de decisión..."
                                    value={desistimientoData.reason}
                                    onChange={e => setDesistimientoData(prev => ({ ...prev, reason: e.target.value }))}
                                />
                            </div>

                            <div className="form-group mb-0">
                                <label className="form-label">Notas Adicionales</label>
                                <textarea
                                    className="form-control"
                                    rows={3}
                                    placeholder="Observaciones, acuerdos, etc."
                                    value={desistimientoData.notes}
                                    onChange={e => setDesistimientoData(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>

                            <div style={{
                                marginTop: 'var(--spacing-4)',
                                padding: 'var(--spacing-3)',
                                background: 'rgba(239,68,68,0.06)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-muted)'
                            }}>
                                ⚠️ <strong>Esta acción es irreversible:</strong> el lote #{sale.lotNumber} quedará disponible para nueva venta y el registro se conservará en el módulo de Desistimientos para auditoría.
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowDesistimientoModal(false)}
                                disabled={isProcessingDesistimiento}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleConfirmDesistimiento}
                                disabled={isProcessingDesistimiento || !desistimientoData.amount_retained}
                                style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
                            >
                                {isProcessingDesistimiento ? (
                                    <><span className="spinner" style={{ width: 14, height: 14 }}></span> Procesando...</>
                                ) : (
                                    <><FiCheckCircle /> Confirmar Desistimiento</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Editar Pago */}
            {editPaymentData && (
                <div className="modal-overlay" onClick={() => !isProcessingEditPayment && setEditPaymentData(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiEdit color="#f59e0b" size={24} />
                                <h3 style={{ margin: 0 }}>Editar Pago</h3>
                            </div>
                            <button className="modal-close" onClick={() => setEditPaymentData(null)} disabled={isProcessingEditPayment}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Monto del Pago *</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={editPaymentData.amount}
                                    onChange={e => setEditPaymentData(prev => ({ ...prev, amount: e.target.value }))}
                                    required
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Fecha del Pago *</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={editPaymentData.payment_date}
                                    onChange={e => setEditPaymentData(prev => ({ ...prev, payment_date: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Método de Pago</label>
                                <select
                                    className="form-control"
                                    value={editPaymentData.payment_method}
                                    onChange={e => setEditPaymentData(prev => ({ ...prev, payment_method: e.target.value }))}
                                >
                                    <option value="cash">Efectivo</option>
                                    <option value="transfer">Transferencia</option>
                                    <option value="exchange">Permuta</option>
                                </select>
                            </div>
                            {editPaymentData.payment_method === 'transfer' && (
                                <div className="form-group">
                                    <label className="form-label">Cuenta Bancaria</label>
                                    <select
                                        className="form-control"
                                        value={editPaymentData.bank_account_id || ''}
                                        onChange={e => setEditPaymentData(prev => ({ ...prev, bank_account_id: e.target.value }))}
                                    >
                                        <option value="">Seleccione una cuenta...</option>
                                        {(state.bankAccounts || []).map(b => (
                                            <option key={b.id} value={b.id}>
                                                {b.bank_name} - {b.account_number}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="form-group mb-0">
                                <label className="form-label">Notas Adicionales</label>
                                <textarea
                                    className="form-control"
                                    rows="2"
                                    value={editPaymentData.notes}
                                    onChange={e => setEditPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                                ></textarea>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setEditPaymentData(null)}
                                disabled={isProcessingEditPayment}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
                                onClick={handleConfirmEditPayment}
                                disabled={isProcessingEditPayment || !editPaymentData.amount || editPaymentData.amount <= 0}
                            >
                                {isProcessingEditPayment ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Editar Venta */}
            {editSaleData && (
                <div className="modal-overlay" onClick={() => !isProcessingEditSale && setEditSaleData(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiEdit color="#f59e0b" size={24} />
                                <h3 style={{ margin: 0 }}>Editar Venta</h3>
                            </div>
                            <button className="modal-close" onClick={() => setEditSaleData(null)} disabled={isProcessingEditSale}>×</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            <div style={{ padding: '12px', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', marginBottom: '16px', color: '#b45309', fontSize: '13px' }}>
                                <strong>Nota:</strong> Editar la venta no recalcula las cuotas pasadas automáticamente. Úsalo para corregir errores simples en la fecha, notas o precios globales.
                            </div>
                            <div className="form-group">
                                <label className="form-label">Precio de Venta Total ($)</label>
                                <CurrencyInput
                                    className="form-control"
                                    value={editSaleData.totalPrice}
                                    onChange={e => setEditSaleData(prev => ({ ...prev, totalPrice: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Fecha de Venta *</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={editSaleData.saleDate}
                                    onChange={e => setEditSaleData(prev => ({ ...prev, saleDate: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tipo de Pago</label>
                                <select
                                    className="form-control"
                                    value={editSaleData.paymentType}
                                    onChange={e => setEditSaleData(prev => ({ ...prev, paymentType: e.target.value }))}
                                >
                                    <option value="cash">Contado</option>
                                    <option value="credit">Crédito</option>
                                </select>
                            </div>
                            {editSaleData.paymentType === 'credit' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Cuota Inicial ($)</label>
                                        <CurrencyInput
                                            className="form-control"
                                            value={editSaleData.downPayment}
                                            onChange={e => setEditSaleData(prev => ({ ...prev, downPayment: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Número de Cuotas</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={editSaleData.numberOfInstallments}
                                            onChange={e => setEditSaleData(prev => ({ ...prev, numberOfInstallments: e.target.value }))}
                                            min="1"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="form-group mb-0">
                                <label className="form-label">Notas Adicionales</label>
                                <textarea
                                    className="form-control"
                                    rows="3"
                                    value={editSaleData.notes}
                                    onChange={e => setEditSaleData(prev => ({ ...prev, notes: e.target.value }))}
                                ></textarea>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setEditSaleData(null)}
                                disabled={isProcessingEditSale}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
                                onClick={handleConfirmEditSale}
                                disabled={isProcessingEditSale || !editSaleData.totalPrice}
                            >
                                {isProcessingEditSale ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Separe Modal */}
            {showSepareModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Generar Contrato PDF</h3>
                            <button className="modal-close" onClick={() => setShowSepareModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: '15px' }}>
                                Si esta venta tuvo un <strong>"Separe"</strong>, ingrésalo aquí. Esto ajustará la redacción de la Cláusula Cuarta. Si no tuvo separe o pagó la cuota inicial de una sola vez, déjalo en cero.
                            </p>
                            <div className="form-group">
                                <label>Monto del Separe ($)</label>
                                <CurrencyInput
                                    className="form-control"
                                    placeholder="Ej: 500000"
                                    value={separeSettings.amount}
                                    onChange={e => setSepareSettings({ ...separeSettings, amount: e.target.value })}
                                />
                            </div>
                            <div className="form-group mb-0">
                                <label>Fecha del Separe</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={separeSettings.date}
                                    onChange={e => setSepareSettings({ ...separeSettings, date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowSepareModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleGenerateContract} disabled={isGeneratingContract}>
                                {isGeneratingContract ? 'Generando...' : 'Confirmar y Generar PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SaleDetail;
