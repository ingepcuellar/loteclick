/**
 * White-Label - Barcode Utilities
 * Generación de códigos de barras y documentos imprimibles
 */
import JsBarcode from 'jsbarcode';
import { brand } from '../config/brandConfig';
import { todayBogota } from './formatters';

/**
 * Convierte URLs relativas de imágenes a absolutas para que funcionen
 * en ventanas de impresión y documentos generados.
 */
export function resolveImageUrl(url) {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    
    // El backend en cPanel sirve las imágenes en /api/uploads/
    const apiBase = import.meta.env.VITE_API_URL || './api';
    const cleanUrl = url.replace(/^\//, '');
    
    if (apiBase.startsWith('http')) {
        if (cleanUrl.startsWith('api/')) {
            const origin = new URL(apiBase).origin;
            return `${origin}/${cleanUrl}`;
        }
        const base = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
        const path = cleanUrl.startsWith('uploads/') ? cleanUrl : `uploads/${cleanUrl}`;
        return `${base}/${path}`;
    } else {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const baseSegment = apiBase.replace(/^\./, '').replace(/\/$/, '');
        const path = cleanUrl.startsWith('uploads/') ? cleanUrl : `uploads/${cleanUrl}`;
        return `${origin}${baseSegment}/${path}`;
    }
}


/**
 * Genera un código de barras basado en el ID de venta
 * Formato: LCK-{8 primeros caracteres del UUID}
 */
export function generateBarcodeValue(id) {
    if (!id) return `${brand.barcodePrefix}-00000000`;
    return `${brand.barcodePrefix}-${id.substring(0, 8).toUpperCase()}`;
}

/**
 * Parsea un input de código de barras y extrae el patrón LCK-XXXXXXXX
 * Retorna el prefijo de 8 caracteres o null si no es válido
 */
export function parseBarcodeInput(input) {
    if (!input) return null;
    const cleaned = input.trim().toUpperCase();
    const pattern = new RegExp(`^${brand.barcodePrefix}-([A-Z0-9]{8})$`);
    const match = cleaned.match(pattern);
    return match ? match[1] : null;
}

/**
 * Genera SVG string de un código de barras Code128
 */
export function generateBarcodeSVGString(value) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');

    try {
        JsBarcode(svg, value, {
            format: 'CODE128',
            width: 2,
            height: 60,
            displayValue: true,
            fontSize: 14,
            margin: 10,
            background: '#ffffff'
        });
        return new XMLSerializer().serializeToString(svg);
    } catch (e) {
        console.error('Error generating barcode:', e);
        return `<svg width="200" height="80"><text x="10" y="40" font-size="14">${value}</text></svg>`;
    }
}

/**
 * Abre una ventana en blanco de forma sincrónica (debe llamarse durante click del usuario).
 * Llamar ANTES de cualquier await para evitar bloqueo de popups.
 */
export function openPrintWindow() {
    return window.open('', '_blank');
}

/**
 * Escribe HTML en una ventana previamente abierta y dispara impresión.
 */
export function writeToPrintWindow(printWindow, html) {
    if (printWindow && !printWindow.closed) {
        printWindow.document.write(html);
        printWindow.document.close();
    }
}

/**
 * Abre ventana + escribe HTML + imprime (solo funciona en contexto sincrónico de click).
 * Para flujos async, usar openPrintWindow() + writeToPrintWindow() por separado.
 */
export function printDocument(html) {
    const win = openPrintWindow();
    writeToPrintWindow(win, html);
}

/**
 * Formatea moneda COP
 */
function fmtCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
    }).format(amount || 0);
}

/**
 * Formatea fecha
 */
function fmtDate(dateStr) {
    if (!dateStr) return 'N/A';
    let d = typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())
        ? new Date(dateStr.trim() + 'T12:00:00')
        : new Date(dateStr);
    return d.toLocaleDateString('es-CO', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

/**
 * Genera el HTML del logo del proyecto si existe, sino usa el logo global de la marca.
 */
function renderProjectLogo(project, size = 'small') {
    const logoUrl = project?.logo_url || project?.logoUrl;
    const imgSize = size === 'large' ? '60px' : '40px';
    const fontSize = size === 'large' ? '24px' : '18px';
    if (logoUrl) {
        return `<div style="display:flex;align-items:center;gap:10px;">
            <img src="${logoUrl}" style="max-height:${imgSize};max-width:120px;object-fit:contain;" onerror="this.style.display='none'" />
            <div>
                <div style="font-size:${fontSize};font-weight:700;color:#2d6a4f;">${project?.name || brand.appName}</div>
                <div style="color:#666;font-size:${size === 'large' ? '12px' : '10px'};margin-top:2px;">${brand.subtitle}</div>
                ${brand.legalName ? `<div style="color:#555;font-size:${size === 'large' ? '11px' : '9px'};margin-top:1px;font-weight:600;">${brand.legalName}</div>` : ''}
                ${brand.nit ? `<div style="color:#777;font-size:${size === 'large' ? '10px' : '9px'};margin-top:1px;">${brand.nit}</div>` : ''}
            </div>
        </div>`;
    }
    return `<div>
        <div class="logo">${brand.emoji} ${brand.appName}</div>
        <div class="logo-sub">${project?.name || brand.subtitle}</div>
        ${brand.legalName ? `<div style="font-size:10px;color:#555;font-weight:600;margin-top:2px;">${brand.legalName}</div>` : ''}
        ${brand.nit ? `<div style="font-size:9px;color:#777;margin-top:1px;">${brand.nit}</div>` : ''}
    </div>`;
}

/**
 * Genera la etiqueta de referencia de la cuota para un recibo.
 */
function getInstallmentLabel(installmentIds, installments) {
    if (!installmentIds || installmentIds.length === 0 || !installments || installments.length === 0) {
        return 'Abono general';
    }
    const labels = installmentIds.map(id => {
        const inst = installments.find(i => i.id === id);
        if (!inst) return null;
        const num = inst.installment_number ?? inst.installmentNumber;
        if (num === 0) return 'Pago Separe';
        if (num === 1) return 'Pago Cuota Inicial';
        return `Pago Cuota No. ${num}`;
    }).filter(Boolean);
    return labels.length > 0 ? labels.join(', ') : 'Abono general';
}

/**
 * Estilos compartidos para documentos imprimibles
 */
const sharedStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: 139.7mm 215.9mm; margin: 8mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 12px; color: #333; font-size: 11px; }
    .doc-container { max-width: 100%; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 2px solid #2d6a4f; padding-bottom: 8px; }
    .logo { font-size: 18px; font-weight: 700; color: #2d6a4f; }
    .logo-sub { color: #666; font-size: 10px; margin-top: 2px; }
    .doc-title { text-align: right; }
    .doc-number { font-size: 12px; font-weight: 600; color: #2d6a4f; }
    .doc-date { color: #666; margin-top: 2px; font-size: 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
    .info-box { background: #f8faf9; padding: 8px 10px; border-radius: 4px; border-left: 2px solid #2d6a4f; }
    .info-box h4 { font-size: 8px; text-transform: uppercase; color: #888; margin-bottom: 4px; letter-spacing: 0.5px; }
    .info-box p { margin: 2px 0; font-size: 10px; }
    .info-box strong { color: #1a1a1a; }
    .section { margin-bottom: 10px; }
    .section-title { font-size: 9px; text-transform: uppercase; color: #2d6a4f; font-weight: 600; margin-bottom: 5px; letter-spacing: 0.8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 5px 6px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
    th { background: #f1f5f3; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 8px; }
    .amount { text-align: right; font-weight: 600; }
    .total-bar { background: linear-gradient(135deg, #2d6a4f, #40916c); color: white; padding: 10px 14px; border-radius: 6px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; }
    .total-bar .label { font-size: 10px; opacity: 0.9; }
    .total-bar .value { font-size: 16px; font-weight: 700; }
    .barcode-section { text-align: center; margin: 12px 0; padding: 8px; border: 1px dashed #ccc; border-radius: 4px; }
    .barcode-section p { font-size: 8px; color: #888; margin-top: 4px; }
    .barcode-section svg { max-height: 40px; width: auto; }
    .footer { margin-top: 12px; text-align: center; color: #888; font-size: 8px; border-top: 1px solid #eee; padding-top: 6px; }
    .signature-area { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px; }
    .signature-line { border-top: 1px solid #333; padding-top: 4px; text-align: center; font-size: 9px; color: #666; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 9px; font-weight: 600; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-paid { background: #dcfce7; color: #166534; }
    .btn-print { display: block; margin: 10px auto 0; padding: 8px 24px; background: #2d6a4f; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; }
    .btn-print:hover { background: #1b4332; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
`;

/**
 * Genera HTML del recibo de venta (para que el cliente lleve a Tesorería)
 */
export function generatePaymentSlipHTML({ sale, client, project, installments, currentUser, selectedInstallment }) {
    const barcodeValue = generateBarcodeValue(sale.id);
    const barcodeSVG = generateBarcodeSVGString(barcodeValue);
    const slipNumber = `RV-${(sale.id || '').substring(0, 8).toUpperCase()}`;

    const paymentTypeName = sale.paymentType === 'installments' || sale.paymentType === 'credit'
        ? 'Crédito (Cuotas)' : 'Contado';

    // Cuota seleccionada destacada
    let cuotaRefHtml = '';
    let cuotaMonto = null;
    if (selectedInstallment) {
        const num = selectedInstallment.installment_number ?? selectedInstallment.installmentNumber;
        const label = num === -1 ? 'Pago Sepáre' : num === 0 ? 'Pago Cuota Inicial' : `Pago Cuota No. ${num}`;
        cuotaMonto = selectedInstallment.amount;
        const due = selectedInstallment.due_date || selectedInstallment.dueDate;
        cuotaRefHtml = `<div style="background:#fff7ed;border:2px solid #f59e0b;border-radius:8px;padding:10px 14px;margin:10px 0;text-align:center;"><div style="font-size:10px;color:#92400e;text-transform:uppercase;font-weight:600;letter-spacing:1px;">Concepto del Pago</div><div style="font-size:16px;font-weight:700;color:#92400e;margin:4px 0;">&#128203; ${label}</div>${due ? `<div style="font-size:10px;color:#b45309;">Vencimiento: ${fmtDate(due)}</div>` : ''}${cuotaMonto ? `<div style="font-size:14px;font-weight:700;color:#2d6a4f;margin-top:4px;">Valor: ${fmtCurrency(cuotaMonto)}</div>` : ''}</div>`;
    }

    let installmentRows = '';
    if (installments && installments.length > 0) {
        installmentRows = installments.map(inst => {
            const num = inst.installment_number ?? inst.installmentNumber;
            const label = num === -1 ? 'Sep\u00e1re' : (num === 0 ? 'Enganche' : `Cuota #${num}`);
            const due = inst.due_date || inst.dueDate;
            const isSel = selectedInstallment && inst.id === selectedInstallment.id;
            const isPaid = inst.status === 'paid';
            const isPartial = inst.status === 'partial';
            const paidAmt = parseFloat(inst.paid_amount || 0);
            let statusIcon = isPaid ? '\u2705' : isPartial ? '\u25d0' : (due && due < todayBogota() ? '\u26a0\ufe0f' : '\u23f3');
            let rowStyle = isSel ? 'background:#fff7ed;font-weight:700;' : isPaid ? 'background:#f0fdf4;color:#666;' : '';
            return `<tr style="${rowStyle}"><td>${label}${isSel ? ' &#9733;' : ''} ${statusIcon}</td><td>${fmtDate(due)}</td><td class="amount">${fmtCurrency(inst.amount)}</td><td class="amount" style="color:#2d6a4f;">${paidAmt > 0 ? fmtCurrency(paidAmt) : '-'}</td></tr>`;
        }).join('');
    }

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Recibo de Venta ${slipNumber}</title>
<style>${sharedStyles}</style></head>
<body>
<div class="doc-container">
    <div class="header">
        ${renderProjectLogo(project)}
        <div style="text-align:center;flex:1;"><div style="font-size:10px;font-weight:600;color:#2d6a4f;text-transform:uppercase;">Recibo de Venta</div></div>
        <div class="doc-title">
            <div class="doc-number">${slipNumber}</div>
            <div class="doc-date">Fecha: ${fmtDate(sale.saleDate || sale.sale_date || sale.createdAt)}</div>
            <div style="margin-top:8px;"><span class="status-badge status-pending">&#9203; PENDIENTE DE PAGO</span></div>
        </div>
    </div>
    ${cuotaRefHtml}

    <div class="info-grid">
        <div class="info-box">
            <h4>Comprador</h4>
            <p><strong>${client?.name || client?.fullName || 'N/A'}</strong></p>
            <p>Doc: ${client?.document || 'N/A'}</p>
            <p>Tel: ${client?.phone || 'N/A'}</p>
        </div>
        <div class="info-box">
            <h4>Propiedad</h4>
            <p><strong>Lote ${sale.lotNumber || 'N/A'}</strong></p>
            ${(sale.lotManzana || sale.lot_manzana) ? `<p>Manzana: ${sale.lotManzana || sale.lot_manzana}</p>` : ''}
            ${(sale.lotEtapaName || sale.lot_etapa_name) ? `<p>Etapa: ${sale.lotEtapaName || sale.lot_etapa_name}</p>` : ''}
            <p>Proyecto: ${project?.name || 'N/A'}</p>
            <p>${project?.location || ''}</p>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Detalle de la Venta</div>
        <table>
            <tr><td>Precio Total</td><td class="amount">${fmtCurrency(sale.totalPrice || sale.sale_price)}</td></tr>
            <tr><td>Tipo de Pago</td><td class="amount">${paymentTypeName}</td></tr>
            ${sale.downPayment > 0 ? `<tr><td>Enganche / Cuota Inicial</td><td class="amount">${fmtCurrency(sale.downPayment || sale.down_payment)}</td></tr>` : ''}
            ${sale.numberOfInstallments > 1 ? `<tr><td>N&uacute;mero de Cuotas</td><td class="amount">${sale.numberOfInstallments || sale.number_of_installments}</td></tr>` : ''}
            ${(sale.includeAcometida || sale.include_acometida) ? `<tr style="color:#f59e0b;font-weight:600;"><td>Acometida ${(sale.acometidaPaid || sale.acometida_paid) ? '(Pagada)' : '(Pendiente)'}</td><td class="amount">${fmtCurrency(sale.acometidaValue || sale.acometida_value || 0)}</td></tr>` : ''}
        </table>
    </div>

    ${installmentRows ? `
    <div class="section">
        <div class="section-title">Plan de Cuotas</div>
        <table>
            <thead><tr><th>Cuota</th><th>Vencimiento</th><th style="text-align:right;">Monto</th><th style="text-align:right;">Pagado</th></tr></thead>
            <tbody>${installmentRows}</tbody>
        </table>
    </div>` : ''}

    <div class="total-bar">
        <span class="label">Total a Pagar</span>
        <span class="value">${fmtCurrency(sale.totalPrice || sale.sale_price)}</span>
    </div>

    <div class="barcode-section">
        ${barcodeSVG}
        <p>Presente este recibo en Tesorería para registrar su pago</p>
    </div>

    <div class="footer">
        <p>${brand.appName} - ${brand.subtitle}</p>
        <p>Documento generado el ${fmtDate(todayBogota())}</p>
    </div>
</div>
<button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir Recibo</button>
</body></html>`;
}

/**
 * Genera HTML del recibo de pago (después de confirmar pago en Tesorería)
 */
export function generatePaymentReceiptHTML({ payment, sale, client, project, currentUser, selectedInstallmentIds, installments }) {
    const barcodeValue = generateBarcodeValue(payment.id || sale.id);
    const barcodeSVG = generateBarcodeSVGString(barcodeValue);
    const receiptNumber = `RP-${(payment.id || '').substring(0, 8).toUpperCase()}`;
    const saleRef = `RV-${(sale.id || '').substring(0, 8).toUpperCase()}`;

    const totalPaid = parseFloat(sale.totalPaid || 0);
    const totalPrice = parseFloat(sale.totalPrice || sale.sale_price || 0);
    const pendingAmount = Math.max(0, totalPrice - totalPaid - parseFloat(payment.amount || 0));
    const isFullyPaid = pendingAmount <= 0;

    // Referencia de cuota(s)
    const installmentRef = getInstallmentLabel(selectedInstallmentIds, installments);

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Recibo de Pago ${receiptNumber}</title>
<style>${sharedStyles}
    .cuota-ref { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; text-align: center; font-weight: 600; color: #c2410c; font-size: 11px; }
</style></head>
<body>
<div class="doc-container">
    <div class="header">
        ${renderProjectLogo(project)}
        <div class="doc-title">
            <div style="font-size:10px;font-weight:600;color:#2d6a4f;text-transform:uppercase;">Recibo de Pago</div>
            <div class="doc-number">${receiptNumber}</div>
            <div class="doc-date">Ref. Venta: ${saleRef}</div>
            <div class="doc-date">Fecha: ${fmtDate(payment.paymentDate || payment.payment_date || new Date().toISOString())}</div>
        </div>
    </div>

    <div class="cuota-ref">📋 Concepto: ${installmentRef}</div>

    <div class="info-grid">
        <div class="info-box">
            <h4>Recibido de</h4>
            <p><strong>${client?.name || client?.fullName || 'N/A'}</strong></p>
            <p>Doc: ${client?.document || 'N/A'}</p>
            <p>Tel: ${client?.phone || 'N/A'}</p>
        </div>
        <div class="info-box">
            <h4>Propiedad</h4>
            <p><strong>Lote ${sale.lotNumber || 'N/A'}</strong></p>
            ${(sale.lotManzana || sale.lot_manzana) ? `<p>Manzana: ${sale.lotManzana || sale.lot_manzana}</p>` : ''}
            ${(sale.lotEtapaName || sale.lot_etapa_name) ? `<p>Etapa: ${sale.lotEtapaName || sale.lot_etapa_name}</p>` : ''}
            <p>Proyecto: ${project?.name || 'N/A'}</p>
            <p>${project?.location || ''}</p>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Detalle del Pago</div>
        <table>
            <tr><td>Monto Pagado</td><td class="amount" style="color: #2d6a4f; font-size: 18px;">${fmtCurrency(payment.amount)}</td></tr>
            <tr><td>Fecha del Pago</td><td class="amount">${fmtDate(payment.paymentDate || payment.payment_date)}</td></tr>
            ${payment.notes ? `<tr><td>Notas</td><td class="amount">${payment.notes}</td></tr>` : ''}
        </table>
    </div>

    <div class="section">
        <div class="section-title">Estado de la Deuda</div>
        <table>
            <tr><td>Precio Total del Lote</td><td class="amount">${fmtCurrency(totalPrice)}</td></tr>
            <tr><td>Total Pagado (incluyendo este pago)</td><td class="amount">${fmtCurrency(totalPaid + parseFloat(payment.amount || 0))}</td></tr>
            <tr><td><strong>Saldo Pendiente</strong></td><td class="amount" style="color: ${isFullyPaid ? '#2d6a4f' : '#b45309'}; font-weight: 700;">
                ${isFullyPaid ? '✅ PAGADO EN SU TOTALIDAD' : fmtCurrency(pendingAmount)}
            </td></tr>
        </table>
    </div>

    <div class="barcode-section">
        ${barcodeSVG}
        <p>Conserve este recibo como comprobante de pago</p>
    </div>

    <div class="signature-area">
        <div>
            ${resolveImageUrl(currentUser?.signature_image || currentUser?.signatureImage) ? `<img src="${resolveImageUrl(currentUser.signature_image || currentUser.signatureImage)}" style="max-height: 50px; margin-bottom: 5px;"/>` : ''}
            <div class="signature-line">Generado por: ${currentUser?.name || 'Tesorero / Cajero'}</div>
        </div>
        <div>
            <div class="signature-line">Cliente</div>
        </div>
    </div>

    <div class="footer">
        <p>${brand.appName} - ${brand.subtitle}</p>
        <p>Documento generado el ${fmtDate(todayBogota())}</p>
    </div>
</div>
<button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir Recibo</button>
</body></html>`;
}

/**
 * Genera HTML de un Estado de Cuenta en formato A4
 */
export function generateAccountStatementHTML({ sale, client, project, installments, payments, currentUser }) {
    const saleRef = `RV-${(sale.id || '').substring(0, 8).toUpperCase()}`;
    // Calculate totalPaid from actual payments, not the potentially stale sale field
    const totalPaid = (payments && payments.length > 0)
        ? payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
        : parseFloat(sale.totalPaid || 0);
    const totalPrice = parseFloat(sale.totalPrice || sale.sale_price || 0);
    const pendingAmount = Math.max(0, totalPrice - totalPaid);
    const lotManzana = sale.lotManzana || sale.lot_manzana || '';
    const lotEtapa = sale.lotEtapaName || sale.lot_etapa_name || '';
    
    // Cuotas vencidas
    const today = todayBogota();
    const overdueInstallments = installments?.filter(i => 
        (i.status === 'pending' || i.status === 'overdue' || i.status === 'partial') && 
        (i.due_date || i.dueDate) < today
    ) || [];
    const overdueTotal = overdueInstallments.reduce((sum, i) => sum + (parseFloat(i.amount) - parseFloat(i.paid_amount || 0)), 0);

    let installmentsHtml = '';
    if (installments && installments.length > 0) {
        installmentsHtml = installments.map(inst => {
            const num = inst.installment_number ?? inst.installmentNumber;
            const label = num === 0 ? 'Enganche' : `Cuota #${num}`;
            const due = inst.due_date || inst.dueDate;
            
            let statusBadge = '';
            if (inst.status === 'paid') statusBadge = '<span style="color:#166534;font-weight:600;">Pagado</span>';
            else if (inst.status === 'partial') statusBadge = '<span style="color:#d97706;font-weight:600;">Abono parcial</span>';
            else if (inst.status === 'overdue') statusBadge = '<span style="color:#b45309;font-weight:600;">Vencido</span>';
            else statusBadge = '<span style="color:#475569;font-weight:600;">Pendiente</span>';

            const pendingInst = parseFloat(inst.amount) - parseFloat(inst.paid_amount || 0);

            return `<tr>
                <td>${label}</td>
                <td>${fmtDate(due)}</td>
                <td class="amount">${fmtCurrency(inst.amount)}</td>
                <td class="amount">${fmtCurrency(inst.paid_amount || 0)}</td>
                <td class="amount" style="color:#b45309;">${fmtCurrency(pendingInst)}</td>
                <td style="text-align:center;">${statusBadge}</td>
            </tr>`;
        }).join('');
    }

    // Pagos Realizados
    let paymentsHtml = '<tr><td colspan="4" style="text-align:center; color:#888;">No se han registrado pagos</td></tr>';
    if (payments && payments.length > 0) {
        paymentsHtml = payments.map(p => {
            return `<tr>
                <td>${fmtDate(p.paymentDate || p.payment_date)}</td>
                <td>${p.paymentMethod === 'transfer' ? 'Transferencia' : (p.paymentMethod === 'cash' ? 'Efectivo' : p.paymentMethod || 'Pago')}</td>
                <td>${p.notes || '-'}</td>
                <td class="amount" style="color:#2d6a4f;font-weight:600;">${fmtCurrency(p.amount)}</td>
            </tr>`;
        }).join('');
    }

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Estado de Cuenta ${saleRef}</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; font-size: 12px; }
    .doc-container { max-width: 100%; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 3px solid #2d6a4f; padding-bottom: 12px; }
    .logo { font-size: 24px; font-weight: 700; color: #2d6a4f; }
    .logo-sub { color: #666; font-size: 12px; margin-top: 4px; }
    .doc-title-box { text-align: right; }
    .doc-title-text { font-size: 18px; font-weight: 700; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; }
    .doc-number { font-size: 14px; font-weight: 600; color: #2d6a4f; margin-top: 4px; }
    
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .info-box { background: #f8faf9; padding: 12px 15px; border-radius: 6px; border-left: 3px solid #2d6a4f; }
    .info-box h4 { font-size: 10px; text-transform: uppercase; color: #666; margin-bottom: 6px; letter-spacing: 0.5px; }
    .info-box p { margin: 4px 0; font-size: 12px; }
    .info-box strong { color: #1a1a1a; }
    
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-title { font-size: 12px; text-transform: uppercase; color: #2d6a4f; font-weight: 700; margin-bottom: 10px; letter-spacing: 1px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
    th { background: #f1f5f3; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 10px; }
    .amount { text-align: right; font-weight: 600; }
    
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px; }
    .summary-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; }
    .summary-box .label { font-size: 10px; color: #666; text-transform: uppercase; display: block; margin-bottom: 5px; }
    .summary-box .value { font-size: 16px; font-weight: 700; color: #1a1a1a; }
    .summary-box.highlight { background: #f8faf9; border-color: #2d6a4f; }
    .summary-box.highlight .value { color: #2d6a4f; }
    .summary-box.warning { background: #fffbeb; border-color: #f59e0b; }
    .summary-box.warning .value { color: #b45309; }
    
    .signature-area { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; page-break-inside: avoid; }
    .signature-box { text-align: center; }
    .signature-line { border-top: 1px solid #333; padding-top: 8px; font-size: 11px; color: #333; font-weight: 600; }
    
    .footer { margin-top: 30px; text-align: center; color: #888; font-size: 10px; border-top: 1px solid #eee; padding-top: 15px; }
    .btn-print { display: block; margin: 20px auto; padding: 10px 30px; background: #2d6a4f; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
    .btn-print:hover { background: #1b4332; }
    @media print { .no-print { display: none !important; } body { padding: 0; background: white; } }
</style></head>
<body>
<div class="doc-container">
    <div class="header">
        ${renderProjectLogo(project, 'large')}
        <div class="doc-title-box">
            <div class="doc-title-text">Estado de Cuenta</div>
            <div class="doc-number">Ref: ${saleRef}</div>
            <div style="font-size: 11px; color: #666; margin-top: 4px;">Fecha de Emisión: ${fmtDate(todayBogota())}</div>
        </div>
    </div>

    <div class="info-grid">
        <div class="info-box">
            <h4>Datos del Cliente</h4>
            <p><strong>${client?.name || client?.fullName || 'N/A'}</strong></p>
            <p>Identificación: ${client?.document || 'N/A'}</p>
            <p>Teléfono: ${client?.phone || 'N/A'}</p>
        </div>
        <div class="info-box">
            <h4>Información de la Propiedad</h4>
            <p><strong>Lote ${sale.lotNumber || 'N/A'}</strong></p>
            ${lotManzana ? `<p>Manzana: ${lotManzana}</p>` : ''}
            ${lotEtapa ? `<p>Etapa: ${lotEtapa}</p>` : ''}
            <p>Proyecto: ${project?.name || 'N/A'}</p>
            <p>Fecha de Venta: ${fmtDate(sale.saleDate || sale.sale_date)}</p>
        </div>
    </div>

    <div class="summary-grid">
        <div class="summary-box">
            <span class="label">Precio Total</span>
            <span class="value">${fmtCurrency(totalPrice)}</span>
        </div>
        <div class="summary-box">
            <span class="label">Total Pagado</span>
            <span class="value" style="color: #2d6a4f;">${fmtCurrency(totalPaid)}</span>
        </div>
        <div class="summary-box highlight">
            <span class="label">Saldo Pendiente</span>
            <span class="value">${fmtCurrency(pendingAmount)}</span>
        </div>
        <div class="summary-box ${overdueTotal > 0 ? 'warning' : ''}">
            <span class="label">Vencido a la Fecha</span>
            <span class="value">${fmtCurrency(overdueTotal)}</span>
        </div>
    </div>

    ${installmentsHtml ? `
    <div class="section">
        <div class="section-title">Plan de Cuotas</div>
        <table>
            <thead>
                <tr>
                    <th>Concepto</th>
                    <th>Vencimiento</th>
                    <th style="text-align:right;">Valor Cuota</th>
                    <th style="text-align:right;">Pagado</th>
                    <th style="text-align:right;">Pendiente</th>
                    <th style="text-align:center;">Estado</th>
                </tr>
            </thead>
            <tbody>${installmentsHtml}</tbody>
        </table>
    </div>` : ''}

    <div class="section">
        <div class="section-title">Historial de Pagos</div>
        <table>
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Método</th>
                    <th>Referencia / Notas</th>
                    <th style="text-align:right;">Monto Pagado</th>
                </tr>
            </thead>
            <tbody>${paymentsHtml}</tbody>
        </table>
    </div>

    <div class="signature-area">
        <div class="signature-box">
            ${resolveImageUrl(currentUser?.signature_image || currentUser?.signatureImage) ? `<img src="${resolveImageUrl(currentUser.signature_image || currentUser.signatureImage)}" style="max-height: 60px; margin-bottom: 10px;"/>` : '<div style="height: 70px;"></div>'}
            <div class="signature-line">Generado por: ${currentUser?.name || 'Administración'}<br><span style="font-size: 9px; font-weight: normal; color: #666;">${brand.appName}</span></div>
        </div>
        <div class="signature-box">
            <div style="height: 70px;"></div>
            <div class="signature-line">Firma del Cliente<br><span style="font-size: 9px; font-weight: normal; color: #666;">Aceptado</span></div>
        </div>
    </div>

    <div class="footer">
        <p>Este estado de cuenta es de carácter informativo y refleja los pagos registrados hasta la fecha de emisión.</p>
        <p>${brand.appName} - ${brand.subtitle}</p>
    </div>
</div>
<button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir Estado de Cuenta</button>
</body></html>`;
}

/**
 * Generate a GLOBAL account statement for a client (all their sales consolidated)
 */
export function generateGlobalAccountStatementHTML({ client, sales, payments, projects, installmentsMap, currentUser }) {
    const clientName = client?.name || client?.fullName || 'Cliente';
    const clientDoc = client?.document || 'N/A';
    const clientPhone = client?.phone || 'N/A';
    const emissionDate = fmtDate(todayBogota());

    let globalTotalPrice = 0;
    let globalTotalPaid = 0;
    
    // Build per-sale sections
    const saleSections = sales.map(sale => {
        const project = projects?.find(p => p.id === sale.projectId) || {};
        const salePayments = payments?.filter(p => p.saleId === sale.id) || [];
        const installments = installmentsMap?.[sale.id] || [];
        const totalPrice = parseFloat(sale.totalPrice || sale.sale_price || 0);
        const totalPaid = salePayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const pending = Math.max(0, totalPrice - totalPaid);
        
        globalTotalPrice += totalPrice;
        globalTotalPaid += totalPaid;

        // Installments rows
        let installmentsRows = '';
        if (installments.length > 0) {
            installmentsRows = installments.map(inst => {
                const num = inst.installment_number ?? inst.installmentNumber;
                const label = num === 0 ? 'Enganche' : `Cuota #${num}`;
                let statusBadge = '';
                if (inst.status === 'paid') statusBadge = '<span style="color:#166534;">✓ Pagado</span>';
                else if (inst.status === 'partial') statusBadge = '<span style="color:#d97706;">◐ Parcial</span>';
                else if (inst.status === 'overdue') statusBadge = '<span style="color:#dc2626;">⚠ Vencido</span>';
                else statusBadge = '<span style="color:#475569;">○ Pendiente</span>';
                return `<tr>
                    <td>${label}</td>
                    <td>${fmtDate(inst.due_date || inst.dueDate)}</td>
                    <td class="amount">${fmtCurrency(inst.amount)}</td>
                    <td class="amount">${fmtCurrency(inst.paid_amount || 0)}</td>
                    <td style="text-align:center;">${statusBadge}</td>
                </tr>`;
            }).join('');
        }

        // Payments rows
        let paymentsRows = '';
        if (salePayments.length > 0) {
            paymentsRows = salePayments.map(p => `<tr>
                <td>${fmtDate(p.paymentDate || p.payment_date || p.date)}</td>
                <td>${(p.paymentMethod || p.payment_method || 'Efectivo').toUpperCase()}</td>
                <td class="amount">${fmtCurrency(p.amount)}</td>
            </tr>`).join('');
        } else {
            paymentsRows = '<tr><td colspan="3" style="text-align:center;color:#888;">Sin pagos registrados</td></tr>';
        }

        const logoUrl = project?.logo_url || '';

        return `
        <div style="border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 20px; page-break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                <div>
                    ${logoUrl ? `<img src="${logoUrl}" style="height: 40px; margin-bottom: 4px;"/>` : ''}
                    <h3 style="margin: 0; color: #1e3a5f; font-size: 14px;">${project?.name || 'Proyecto'}</h3>
                    <p style="margin: 2px 0; font-size: 11px; color: #666;">Lote ${sale.lotNumber || 'N/A'}</p>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 13px;"><strong>Total:</strong> ${fmtCurrency(totalPrice)}</div>
                    <div style="font-size: 13px; color: #166534;"><strong>Pagado:</strong> ${fmtCurrency(totalPaid)}</div>
                    <div style="font-size: 13px; color: ${pending > 0 ? '#dc2626' : '#166534'}; font-weight: 700;"><strong>Saldo:</strong> ${fmtCurrency(pending)}</div>
                </div>
            </div>

            ${installments.length > 0 ? `
            <div style="margin-bottom: 12px;">
                <h4 style="margin: 0 0 6px; font-size: 12px; color: #374151;">Plan de Cuotas</h4>
                <table style="width:100%; border-collapse:collapse; font-size:11px;">
                    <thead><tr style="background:#f3f4f6;">
                        <th style="padding:4px 6px; text-align:left;">Cuota</th>
                        <th style="padding:4px 6px; text-align:left;">Vencimiento</th>
                        <th style="padding:4px 6px; text-align:right;">Monto</th>
                        <th style="padding:4px 6px; text-align:right;">Pagado</th>
                        <th style="padding:4px 6px; text-align:center;">Estado</th>
                    </tr></thead>
                    <tbody>${installmentsRows}</tbody>
                </table>
            </div>` : ''}

            <div>
                <h4 style="margin: 0 0 6px; font-size: 12px; color: #374151;">Pagos Realizados</h4>
                <table style="width:100%; border-collapse:collapse; font-size:11px;">
                    <thead><tr style="background:#f3f4f6;">
                        <th style="padding:4px 6px; text-align:left;">Fecha</th>
                        <th style="padding:4px 6px; text-align:left;">Método</th>
                        <th style="padding:4px 6px; text-align:right;">Monto</th>
                    </tr></thead>
                    <tbody>${paymentsRows}</tbody>
                </table>
            </div>
        </div>`;
    }).join('');

    const globalPending = Math.max(0, globalTotalPrice - globalTotalPaid);

    return `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>Estado de Cuenta Global - ${clientName}</title>
<style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e3a5f; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 20px; color: #1e3a5f; }
    .header h2 { margin: 4px 0 0; font-size: 13px; color: #64748b; font-weight: 400; }
    .client-info { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px; display: flex; gap: 40px; }
    .client-info div { flex: 1; }
    .client-info label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .client-info p { margin: 2px 0 8px; font-size: 13px; font-weight: 600; }
    .summary-box { display: flex; gap: 12px; margin-bottom: 20px; }
    .summary-item { flex: 1; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px; text-align: center; }
    .summary-item.danger { background: #fef2f2; border-color: #fecaca; }
    .summary-item.success { background: #f0fdf4; border-color: #bbf7d0; }
    .summary-item .label { font-size: 10px; color: #64748b; text-transform: uppercase; }
    .summary-item .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
    .amount { text-align: right; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    .signature-area { display: flex; justify-content: space-between; margin-top: 40px; }
    .signature-box { text-align: center; width: 45%; }
    .signature-line { border-top: 1px solid #333; padding-top: 6px; font-size: 11px; font-weight: 600; }
    @media print { .no-print { display: none !important; } }
    .btn-print { position: fixed; bottom: 20px; right: 20px; padding: 12px 24px; background: #1e3a5f; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
</style>
</head><body>

<div class="header">
    <div>
        <h1>ESTADO DE CUENTA GLOBAL</h1>
        <h2>${brand.appName} - ${brand.subtitle}</h2>
    </div>
    <div style="text-align: right; font-size: 11px;">
        <div><strong>Fecha de Emisión:</strong> ${emissionDate}</div>
        <div><strong>Total Ventas:</strong> ${sales.length}</div>
    </div>
</div>

<div class="client-info">
    <div>
        <label>Cliente</label>
        <p>${clientName}</p>
    </div>
    <div>
        <label>Documento</label>
        <p>${clientDoc}</p>
    </div>
    <div>
        <label>Teléfono</label>
        <p>${clientPhone}</p>
    </div>
</div>

<div class="summary-box">
    <div class="summary-item">
        <div class="label">Total Comprometido</div>
        <div class="value" style="color:#1e3a5f;">${fmtCurrency(globalTotalPrice)}</div>
    </div>
    <div class="summary-item success">
        <div class="label">Total Pagado</div>
        <div class="value" style="color:#166534;">${fmtCurrency(globalTotalPaid)}</div>
    </div>
    <div class="summary-item ${globalPending > 0 ? 'danger' : 'success'}">
        <div class="label">Saldo Pendiente</div>
        <div class="value" style="color:${globalPending > 0 ? '#dc2626' : '#166534'};">${fmtCurrency(globalPending)}</div>
    </div>
</div>

<h3 style="margin: 0 0 12px; font-size: 15px; color: #1e3a5f; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">Detalle por Venta</h3>

${saleSections}

<div class="signature-area">
    <div class="signature-box">
        ${resolveImageUrl(currentUser?.signature_image || currentUser?.signatureImage) ? `<img src="${resolveImageUrl(currentUser.signature_image || currentUser.signatureImage)}" style="max-height: 60px; margin-bottom: 10px;"/>` : '<div style="height: 70px;"></div>'}
        <div class="signature-line">Generado por: ${currentUser?.name || 'Administración'}<br><span style="font-size: 9px; font-weight: normal; color: #666;">${brand.appName}</span></div>
    </div>
    <div class="signature-box">
        <div style="height: 70px;"></div>
        <div class="signature-line">Firma del Cliente<br><span style="font-size: 9px; font-weight: normal; color: #666;">Aceptado</span></div>
    </div>
</div>

<div class="footer">
    <p>Este estado de cuenta consolida todas las obligaciones del cliente con la empresa a la fecha de emisión.</p>
    <p>${brand.appName} - ${brand.subtitle}</p>
</div>

<button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir Estado de Cuenta Global</button>
</body></html>`;
}
