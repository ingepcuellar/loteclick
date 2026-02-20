/**
 * LoteClick - Barcode Utilities
 * Generación de códigos de barras y documentos imprimibles
 */
import JsBarcode from 'jsbarcode';

/**
 * Genera un código de barras basado en el ID de venta
 * Formato: LCK-{8 primeros caracteres del UUID}
 */
export function generateBarcodeValue(id) {
    if (!id) return 'LCK-00000000';
    return `LCK-${id.substring(0, 8).toUpperCase()}`;
}

/**
 * Parsea un input de código de barras y extrae el patrón LCK-XXXXXXXX
 * Retorna el prefijo de 8 caracteres o null si no es válido
 */
export function parseBarcodeInput(input) {
    if (!input) return null;
    const cleaned = input.trim().toUpperCase();
    const match = cleaned.match(/^LCK-([A-Z0-9]{8})$/);
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
    return new Date(dateStr).toLocaleDateString('es-CO', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
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
export function generatePaymentSlipHTML({ sale, client, project, installments }) {
    const barcodeValue = generateBarcodeValue(sale.id);
    const barcodeSVG = generateBarcodeSVGString(barcodeValue);
    const slipNumber = `RV-${(sale.id || '').substring(0, 8).toUpperCase()}`;

    const paymentTypeName = sale.paymentType === 'installments' || sale.paymentType === 'credit'
        ? 'Crédito (Cuotas)' : 'Contado';

    let installmentRows = '';
    if (installments && installments.length > 0) {
        installmentRows = installments.slice(0, 6).map(inst => {
            const num = inst.installment_number ?? inst.installmentNumber;
            const label = num === 0 ? 'Enganche' : `Cuota #${num}`;
            const due = inst.due_date || inst.dueDate;
            return `<tr>
                <td>${label}</td>
                <td>${fmtDate(due)}</td>
                <td class="amount">${fmtCurrency(inst.amount)}</td>
            </tr>`;
        }).join('');
        if (installments.length > 6) {
            installmentRows += `<tr><td colspan="3" style="text-align:center; color:#888;">... y ${installments.length - 6} cuotas más</td></tr>`;
        }
    }

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Recibo de Venta ${slipNumber}</title>
<style>${sharedStyles}</style></head>
<body>
<div class="doc-container">
    <div class="header">
        <div>
            <div class="logo">🏡 LoteClick</div>
            <div class="logo-sub">Recibo de Venta</div>
        </div>
        <div class="doc-title">
            <div class="doc-number">${slipNumber}</div>
            <div class="doc-date">Fecha: ${fmtDate(sale.saleDate || sale.sale_date || sale.createdAt)}</div>
            <div style="margin-top:8px;"><span class="status-badge status-pending">⏳ PENDIENTE DE PAGO</span></div>
        </div>
    </div>

    <div class="info-grid">
        <div class="info-box">
            <h4>Comprador</h4>
            <p><strong>${client?.name || client?.fullName || 'N/A'}</strong></p>
            <p>Doc: ${client?.document || 'N/A'}</p>
            <p>Tel: ${client?.phone || 'N/A'}</p>
        </div>
        <div class="info-box">
            <h4>Propiedad</h4>
            <p><strong>Lote #${sale.lotNumber || 'N/A'}</strong></p>
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
            ${sale.numberOfInstallments > 1 ? `<tr><td>Número de Cuotas</td><td class="amount">${sale.numberOfInstallments || sale.number_of_installments}</td></tr>` : ''}
        </table>
    </div>

    ${installmentRows ? `
    <div class="section">
        <div class="section-title">Plan de Pagos</div>
        <table>
            <thead><tr><th>Cuota</th><th>Fecha Vencimiento</th><th style="text-align:right;">Monto</th></tr></thead>
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
        <p>LoteClick - Sistema de Gestión de Loteos</p>
        <p>Documento generado el ${fmtDate(new Date().toISOString())}</p>
    </div>
</div>
<button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir Recibo</button>
</body></html>`;
}

/**
 * Genera HTML del recibo de pago (después de confirmar pago en Tesorería)
 */
export function generatePaymentReceiptHTML({ payment, sale, client, project }) {
    const barcodeValue = generateBarcodeValue(payment.id || sale.id);
    const barcodeSVG = generateBarcodeSVGString(barcodeValue);
    const receiptNumber = `RP-${(payment.id || '').substring(0, 8).toUpperCase()}`;
    const saleRef = `RV-${(sale.id || '').substring(0, 8).toUpperCase()}`;

    const totalPaid = parseFloat(sale.totalPaid || 0);
    const totalPrice = parseFloat(sale.totalPrice || sale.sale_price || 0);
    const pendingAmount = Math.max(0, totalPrice - totalPaid - parseFloat(payment.amount || 0));
    const isFullyPaid = pendingAmount <= 0;

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Recibo de Pago ${receiptNumber}</title>
<style>${sharedStyles}</style></head>
<body>
<div class="doc-container">
    <div class="header">
        <div>
            <div class="logo">🏡 LoteClick</div>
            <div class="logo-sub">Recibo de Pago</div>
        </div>
        <div class="doc-title">
            <div class="doc-number">${receiptNumber}</div>
            <div class="doc-date">Ref. Venta: ${saleRef}</div>
            <div class="doc-date">Fecha: ${fmtDate(payment.paymentDate || payment.payment_date || new Date().toISOString())}</div>
        </div>
    </div>

    <div class="info-grid">
        <div class="info-box">
            <h4>Recibido de</h4>
            <p><strong>${client?.name || client?.fullName || 'N/A'}</strong></p>
            <p>Doc: ${client?.document || 'N/A'}</p>
            <p>Tel: ${client?.phone || 'N/A'}</p>
        </div>
        <div class="info-box">
            <h4>Propiedad</h4>
            <p><strong>Lote #${sale.lotNumber || 'N/A'}</strong></p>
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
            <div class="signature-line">Tesorero / Cajero</div>
        </div>
        <div>
            <div class="signature-line">Cliente</div>
        </div>
    </div>

    <div class="footer">
        <p>LoteClick - Sistema de Gestión de Loteos</p>
        <p>Documento generado el ${fmtDate(new Date().toISOString())}</p>
    </div>
</div>
<button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir Recibo</button>
</body></html>`;
}
