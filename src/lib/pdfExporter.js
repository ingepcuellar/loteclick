/**
 * White-Label - PDF Exporter Utility
 * Genera reportes PDF profesionales usando jsPDF + autoTable
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { brand } from '../config/brandConfig';

const COLORS = {
    primary:     [99, 102, 241],
    primaryDark: [79, 70, 229],
    success:     [34, 197, 94],
    warning:     [245, 158, 11],
    error:       [239, 68, 68],
    text:        [30, 41, 59],
    muted:       [100, 116, 139],
    bg:          [248, 250, 252],
    white:       [255, 255, 255]
};

// Helper: strip accented/special chars for jsPDF helvetica compatibility
const safe = (str) => String(str || '')
    .replace(/[áàäâ]/gi, 'a')
    .replace(/[éèëê]/gi, 'e')
    .replace(/[íìïî]/gi, 'i')
    .replace(/[óòöô]/gi, 'o')
    .replace(/[úùüû]/gi, 'u')
    .replace(/ñ/gi, 'n')
    .replace(/ç/gi, 'c')
    .replace(/[–—−]/g, '-')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");

/**
 * Export a report to PDF
 */
export function exportReportToPDF({
    title,
    subtitle = '',
    columns,
    data,
    stats = [],
    filename = 'reporte',
    period = '',
    project = ''
}) {
    const doc = new jsPDF('landscape', 'mm', 'letter');
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 15;

    // HEADER
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(...COLORS.primaryDark);
    doc.rect(0, 0, pageWidth * 0.4, 28, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.white);
    doc.text(safe(brand.appName), 14, 13);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(safe(title), 14, 21);

    doc.setFontSize(8);
    doc.setTextColor(200, 210, 230);
    const dateStr = `Generado: ${new Date().toLocaleDateString('es-CO', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })}`;
    doc.text(safe(dateStr), pageWidth - 14, 10, { align: 'right' });
    if (period)  doc.text(safe(`Periodo: ${period}`),   pageWidth - 14, 16, { align: 'right' });
    if (project) doc.text(safe(`Proyecto: ${project}`), pageWidth - 14, 22, { align: 'right' });

    y = 35;

    // STAT CARDS
    if (stats.length > 0) {
        const cardWidth = Math.min((pageWidth - 28 - (stats.length - 1) * 6) / stats.length, 65);
        const startX = 14;

        stats.forEach((stat, i) => {
            const x = startX + i * (cardWidth + 6);
            doc.setFillColor(...COLORS.bg);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(x, y, cardWidth, 18, 2, 2, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...COLORS.text);
            doc.text(String(stat.value), x + cardWidth / 2, y + 8, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...COLORS.muted);
            doc.text(safe(stat.label), x + cardWidth / 2, y + 14, { align: 'center' });
        });

        y += 25;
    }

    // SUBTITLE
    if (subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.muted);
        doc.text(safe(subtitle), 14, y);
        y += 6;
    }

    // TABLE
    autoTable(doc, {
        startY: y,
        head: [columns.map(c => safe(c))],
        body: data.map(row => row.map(cell => safe(String(cell ?? '')))),
        theme: 'grid',
        styles: {
            fontSize: 8, cellPadding: 3,
            lineColor: [226, 232, 240], lineWidth: 0.3,
            textColor: COLORS.text, font: 'helvetica'
        },
        headStyles: {
            fillColor: COLORS.primary, textColor: COLORS.white,
            fontStyle: 'bold', fontSize: 8, halign: 'center'
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            ...(columns.length > 3 ? {
                [columns.length - 1]: { halign: 'right' },
                [columns.length - 2]: { halign: 'right' },
                [columns.length - 3]: { halign: 'right' }
            } : {})
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...COLORS.muted);
            const pageNum = doc.internal.getNumberOfPages();
            doc.text(
                `${safe(brand.appName)} - ${safe(title)} | Pagina ${data.pageNumber} de ${pageNum}`,
                pageWidth / 2, pageHeight - 8, { align: 'center' }
            );
        }
    });

    const today = new Date().toISOString().split('T')[0];
    doc.save(`${filename}_${today}.pdf`);
}

/**
 * Export sales report
 */
export function exportSalesPDF(filteredSales, clients, projects, getPaymentsBySale, formatCurrency, formatDate, period, project) {
    const columns = ['Fecha', 'Proyecto', 'Lote', 'Cliente', 'Precio Total', 'Pagado', 'Estado'];

    const data = filteredSales.map(sale => {
        const client = clients.find(c => c.id === sale.clientId);
        const proj   = projects.find(p => p.id === sale.projectId);
        const paid   = getPaymentsBySale(sale.id).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const status = paid >= parseFloat(sale.totalPrice) ? 'Pagado' : 'Pendiente';
        return [
            formatDate(sale.createdAt),
            proj?.name || '',
            sale.lotNumber,
            client?.name || client?.fullName || '',
            formatCurrency(sale.totalPrice),
            formatCurrency(paid),
            status
        ];
    });

    const totalSales = filteredSales.reduce((sum, s) => sum + parseFloat(s.totalPrice || 0), 0);
    const totalPaid  = filteredSales.reduce((sum, s) => sum + getPaymentsBySale(s.id).reduce((p, pay) => p + parseFloat(pay.amount || 0), 0), 0);

    exportReportToPDF({
        title: 'Reporte de Ventas',
        subtitle: `${filteredSales.length} ventas registradas`,
        columns, data,
        stats: [
            { label: 'Total Ventas',  value: filteredSales.length },
            { label: 'Valor Total',   value: formatCurrency(totalSales) },
            { label: 'Recaudado',     value: formatCurrency(totalPaid) },
            { label: 'Pendiente',     value: formatCurrency(totalSales - totalPaid) }
        ],
        filename: 'ventas', period, project
    });
}

/**
 * Export payments report - incluye Modalidad de pago
 */
export function exportPaymentsPDF(filteredPayments, sales, clients, projects, formatCurrency, formatDate, period, project) {
    const columns = ['Fecha', 'Cliente', 'Documento', 'Proyecto', 'Lote', 'Monto', 'Modalidad'];

    const data = filteredPayments.map(payment => {
        const sale   = sales.find(s => s.id === (payment.saleId || payment.sale_id));
        const client = sale ? clients.find(c => c.id === (sale.clientId || sale.client_id)) : null;
        const proj   = sale ? projects.find(p => p.id === (sale.projectId || sale.project_id)) : null;
        const metodo = (payment.paymentMethod || payment.payment_method) === 'transfer' ? 'Transferencia' : 'Efectivo';
        return [
            formatDate(payment.paymentDate || payment.payment_date || payment.createdAt),
            client?.name || client?.fullName || '',
            client?.document || '',
            proj?.name || '',
            sale?.lotNumber || sale?.lot_number || '',
            formatCurrency(payment.amount),
            metodo
        ];
    });

    const totalCash     = filteredPayments.filter(p => (p.paymentMethod || p.payment_method || 'cash') !== 'transfer').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const totalTransfer = filteredPayments.filter(p => (p.paymentMethod || p.payment_method) === 'transfer').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const totalPayments = filteredPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    exportReportToPDF({
        title: 'Reporte de Recaudo',
        subtitle: `${filteredPayments.length} pagos registrados`,
        columns, data,
        stats: [
            { label: 'Total Pagos',      value: filteredPayments.length },
            { label: 'Total Recaudado',  value: formatCurrency(totalPayments) },
            { label: 'Efectivo',         value: formatCurrency(totalCash) },
            { label: 'Transferencia',    value: formatCurrency(totalTransfer) }
        ],
        filename: 'pagos', period, project
    });
}

/**
 * Export expenses report
 */
export function exportExpensesPDF(filteredExpenses, projects, categoryLabels, formatCurrency, formatDate, period, project) {
    const columns = ['Fecha', 'Proyecto', 'Categoria', 'Descripcion', 'Monto'];

    const data = filteredExpenses.map(expense => {
        const proj = projects.find(p => p.id === (expense.projectId || expense.project_id));
        return [
            formatDate(expense.date || expense.expense_date || expense.createdAt),
            proj?.name || '',
            categoryLabels[expense.category] || expense.category,
            expense.description || '',
            formatCurrency(expense.amount)
        ];
    });

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    exportReportToPDF({
        title: 'Reporte de Gastos',
        subtitle: `${filteredExpenses.length} gastos registrados`,
        columns, data,
        stats: [
            { label: 'Total Gastos', value: filteredExpenses.length },
            { label: 'Monto Total',  value: formatCurrency(totalExpenses) }
        ],
        filename: 'gastos', period, project
    });
}

/**
 * Export agent performance report
 */
export function exportAgentsPDF(agentPerformance, formatCurrency, period, project) {
    const columns = ['Comisionista', 'Proyectos', 'Ventas', 'Total Vendido', 'Comision', 'Recaudado', 'Pendiente'];

    const data = agentPerformance.map(agent => [
        agent.name,
        agent.projects.join(', '),
        String(agent.salesCount),
        formatCurrency(agent.totalRevenue),
        formatCurrency(agent.commissionTotal),
        formatCurrency(agent.collected),
        formatCurrency(agent.pending)
    ]);

    exportReportToPDF({
        title: 'Reporte de Comisionistas',
        subtitle: `${agentPerformance.length} comisionistas`,
        columns, data,
        stats: [
            { label: 'Comisionistas',   value: agentPerformance.length },
            { label: 'Total Ventas',    value: agentPerformance.reduce((s, a) => s + a.salesCount, 0) },
            { label: 'Total Vendido',   value: formatCurrency(agentPerformance.reduce((s, a) => s + a.totalRevenue, 0)) },
            { label: 'Total Comisiones',value: formatCurrency(agentPerformance.reduce((s, a) => s + a.commissionTotal, 0)) }
        ],
        filename: 'comisionistas', period, project
    });
}

/**
 * Export desistimientos report
 */
export function exportDesistimientosPDF(filteredDesistimientos, projects, clients, formatCurrency, formatDate, period, project) {
    const columns = ['Fecha', 'Proyecto', 'Lote', 'Cliente', 'Pagado', 'Retenido', 'Devuelto'];

    const data = filteredDesistimientos.map(d => {
        const proj   = projects.find(p => p.id === d.project_id);
        const client = clients.find(c => c.id === d.client_id);
        const retained = parseFloat(d.amount_retained || 0);
        const returned = parseFloat(d.amount_returned || 0);
        const totalPaid = retained + returned;
        return [
            formatDate(d.desistimiento_date || d.created_at),
            proj?.name || '',
            d.lot_number || '',
            client?.name || client?.fullName || 'Desconocido',
            formatCurrency(totalPaid),
            formatCurrency(retained),
            formatCurrency(returned)
        ];
    });

    const totalRetained = filteredDesistimientos.reduce((sum, d) => sum + parseFloat(d.amount_retained || 0), 0);
    const totalReturned = filteredDesistimientos.reduce((sum, d) => sum + parseFloat(d.amount_returned || 0), 0);

    exportReportToPDF({
        title: 'Reporte de Desistimientos',
        subtitle: `${filteredDesistimientos.length} desistimientos registrados`,
        columns, data,
        stats: [
            { label: 'Desistimientos', value: filteredDesistimientos.length },
            { label: 'Total Retenido', value: formatCurrency(totalRetained) },
            { label: 'Total Devuelto', value: formatCurrency(totalReturned) }
        ],
        filename: 'desistimientos', period, project
    });
}

/**
 * Export partners distribution report
 */
export function exportPartnersPDF(partnerDistribution, formatCurrency, period, project) {
    const columns = ['Socio', '% Participacion', 'Total Corresponde', 'Ya Entregado', 'Pendiente de Entrega'];

    const data = partnerDistribution.map(partner => [
        partner.name,
        `${partner.percentage}%`,
        formatCurrency(partner.amount),
        formatCurrency(partner.expensesPaid || 0),
        formatCurrency(partner.remaining ?? partner.amount)
    ]);

    const totalAmount    = partnerDistribution.reduce((sum, p) => sum + p.amount, 0);
    const totalPaid      = partnerDistribution.reduce((sum, p) => sum + (p.expensesPaid || 0), 0);
    const totalRemaining = partnerDistribution.reduce((sum, p) => sum + (p.remaining ?? p.amount), 0);
    const netBase        = partnerDistribution[0]?.netBase;

    exportReportToPDF({
        title: 'Reporte de Entrega a Socios',
        subtitle: `Utilidad neta del periodo${netBase !== undefined ? ': ' + formatCurrency(netBase) : ''}`,
        columns, data,
        stats: [
            { label: 'Total Socios',     value: partnerDistribution.length },
            { label: 'Total a Repartir', value: formatCurrency(totalAmount) },
            { label: 'Ya Entregado',     value: formatCurrency(totalPaid) },
            { label: 'Pendiente',        value: formatCurrency(totalRemaining) }
        ],
        filename: 'entrega_socios', period, project
    });
}

/**
 * Export month-end close (Cierre de Mes)
 * Formula: Recaudo - Gastos Operativos = Utilidad Neta
 * Desistimientos: solo informativos, no afectan la formula
 * Socios: entregadoPeriodo ya viene calculado desde la app
 */
export function exportMonthClosePDF(monthData, partnerDistribution, formatCurrency, period, project) {
    const doc = new jsPDF('landscape', 'mm', 'letter');
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 15;

    // HEADER
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(...COLORS.primaryDark);
    doc.rect(0, 0, pageWidth * 0.4, 28, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.white);
    doc.text(safe(brand.appName), 14, 13);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Cierre de Mes - Informe Gerencial', 14, 21);

    doc.setFontSize(8);
    doc.setTextColor(200, 210, 230);
    const dateStr = `Generado: ${new Date().toLocaleDateString('es-CO', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })}`;
    doc.text(safe(dateStr), pageWidth - 14, 10, { align: 'right' });
    if (period)  doc.text(safe(`Periodo: ${period}`),   pageWidth - 14, 16, { align: 'right' });
    if (project) doc.text(safe(`Proyecto: ${project}`), pageWidth - 14, 22, { align: 'right' });

    y = 36;

    // 3 KPI CARDS: Recaudo / Gastos / Utilidad
    const cards = [
        { label: 'Recaudo del Periodo', value: formatCurrency(monthData.paymentsAmount), color: [16, 185, 129] },
        { label: 'Gastos Operativos',   value: formatCurrency(monthData.expensesAmount),  color: [239, 68, 68]  },
        { label: 'Utilidad Neta',       value: formatCurrency(monthData.netProfit),        color: monthData.netProfit >= 0 ? [16, 185, 129] : [239, 68, 68] },
    ];

    const cardW = (pageWidth - 28 - 2 * 8) / 3;
    cards.forEach((card, i) => {
        const x = 14 + i * (cardW + 8);
        doc.setFillColor(...COLORS.bg);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, cardW, 22, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...card.color);
        doc.text(card.value, x + cardW / 2, y + 10, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.muted);
        doc.text(card.label, x + cardW / 2, y + 17, { align: 'center' });
    });

    y += 28;

    // FORMULA VISUAL
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, y, pageWidth - 28, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const formula = `${formatCurrency(monthData.paymentsAmount)} (Recaudo) - ${formatCurrency(monthData.expensesAmount)} (Gastos Operativos) = ${formatCurrency(monthData.netProfit)} Utilidad Neta`;
    doc.setTextColor(...COLORS.text);
    doc.text(formula, pageWidth / 2, y + 6.5, { align: 'center' });
    y += 14;

    // NOTA INFORMATIVA DESISTIMIENTOS
    if (monthData.devolucionesAmount > 0) {
        doc.setFillColor(255, 250, 235);
        doc.setDrawColor(245, 158, 11);
        doc.roundedRect(14, y, pageWidth - 28, 10, 2, 2, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(180, 100, 0);
        const count   = monthData.desistimientosCount || 0;
        const desNota = `Informativo - Desistimientos del periodo: ${count} caso(s) | Devuelto al cliente: ${formatCurrency(monthData.devolucionesAmount)} | Retenido empresa: ${formatCurrency(monthData.retainedAmount || 0)} (No afectan la utilidad neta)`;
        doc.text(desNota, pageWidth / 2, y + 6.5, { align: 'center' });
        y += 14;
    }

    y += 4;

    // DISTRIBUCION POR SOCIO
    if (partnerDistribution && partnerDistribution.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.primary);
        doc.text('Distribucion por Socio', 14, y);
        y += 4;

        const totalEntregado = partnerDistribution.reduce((s, p) => s + (p.entregadoPeriodo || 0), 0);
        const totalPendiente = partnerDistribution.reduce((s, p) => s + Math.max(0, p.amount - (p.entregadoPeriodo || 0)), 0);

        const partnerRows = partnerDistribution.map(p => {
            const leCorresponde = p.amount;
            const entregado     = p.entregadoPeriodo || 0;
            const pendiente     = Math.max(0, leCorresponde - entregado);
            return [
                safe(p.name),
                `${p.percentage}%`,
                formatCurrency(leCorresponde),
                formatCurrency(entregado),
                formatCurrency(pendiente),
            ];
        });

        partnerRows.push(['TOTAL', '100%', formatCurrency(monthData.netProfit), formatCurrency(totalEntregado), formatCurrency(totalPendiente)]);

        autoTable(doc, {
            startY: y,
            head: [['Socio', '%', 'Le corresponde', 'Ya entregado (periodo)', 'Pendiente']],
            body: partnerRows,
            theme: 'grid',
            styles:     { fontSize: 9, cellPadding: 4, textColor: COLORS.text },
            headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', halign: 'center' },
            columnStyles: {
                1: { halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'right', textColor: [16, 185, 129] },
                4: { halign: 'right', textColor: [245, 158, 11] },
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            didParseCell: (data) => {
                if (data.row.index === partnerRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [226, 232, 240];
                    data.cell.styles.textColor = COLORS.text;
                }
            },
            margin: { left: 14, right: 14 },
            didDrawPage: (data) => {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(...COLORS.muted);
                const pageNum = doc.internal.getNumberOfPages();
                doc.text(
                    `${safe(brand.appName)} - Cierre de Mes | Pagina ${data.pageNumber} de ${pageNum}`,
                    pageWidth / 2, pageHeight - 8, { align: 'center' }
                );
            }
        });
    }

    const today = new Date().toISOString().split('T')[0];
    doc.save(`cierre_de_mes_${today}.pdf`);
}