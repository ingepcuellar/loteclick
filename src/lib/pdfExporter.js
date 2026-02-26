/**
 * PredioClick - PDF Exporter Utility
 * Genera reportes PDF profesionales usando jsPDF + autoTable
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = {
    primary: [99, 102, 241],      // Indigo
    primaryDark: [79, 70, 229],
    success: [34, 197, 94],
    warning: [245, 158, 11],
    error: [239, 68, 68],
    text: [30, 41, 59],
    muted: [100, 116, 139],
    bg: [248, 250, 252],
    white: [255, 255, 255]
};

/**
 * Export a report to PDF
 * @param {Object} config
 * @param {string} config.title - Report title
 * @param {string} config.subtitle - Report subtitle
 * @param {string[]} config.columns - Column headers
 * @param {Array<string[]>} config.data - Table rows (array of arrays)
 * @param {Object[]} config.stats - Optional KPI cards [{label, value}]
 * @param {string} config.filename - Output filename (without .pdf)
 * @param {string} config.period - Period description
 * @param {string} config.project - Project name filter
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
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 15;

    // ======== HEADER ========
    // Background bar
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Gradient effect
    doc.setFillColor(...COLORS.primaryDark);
    doc.rect(0, 0, pageWidth * 0.4, 28, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.white);
    doc.text('PredioClick', 14, 13);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(title, 14, 21);

    // Date & filters (right side)
    doc.setFontSize(8);
    doc.setTextColor(200, 210, 230);
    const dateStr = `Generado: ${new Date().toLocaleDateString('es-CO', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })}`;
    doc.text(dateStr, pageWidth - 14, 10, { align: 'right' });

    if (period) {
        doc.text(`Período: ${period}`, pageWidth - 14, 16, { align: 'right' });
    }
    if (project) {
        doc.text(`Proyecto: ${project}`, pageWidth - 14, 22, { align: 'right' });
    }

    y = 35;

    // ======== STAT CARDS ========
    if (stats.length > 0) {
        const cardWidth = Math.min((pageWidth - 28 - (stats.length - 1) * 6) / stats.length, 65);
        const startX = 14;

        stats.forEach((stat, i) => {
            const x = startX + i * (cardWidth + 6);

            // Card background
            doc.setFillColor(...COLORS.bg);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(x, y, cardWidth, 18, 2, 2, 'FD');

            // Value
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...COLORS.text);
            doc.text(String(stat.value), x + cardWidth / 2, y + 8, { align: 'center' });

            // Label
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...COLORS.muted);
            doc.text(stat.label, x + cardWidth / 2, y + 14, { align: 'center' });
        });

        y += 25;
    }

    // ======== SUBTITLE ========
    if (subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.muted);
        doc.text(subtitle, 14, y);
        y += 6;
    }

    // ======== TABLE ========
    autoTable(doc, {
        startY: y,
        head: [columns],
        body: data,
        theme: 'grid',
        styles: {
            fontSize: 8,
            cellPadding: 3,
            lineColor: [226, 232, 240],
            lineWidth: 0.3,
            textColor: COLORS.text,
            font: 'helvetica'
        },
        headStyles: {
            fillColor: COLORS.primary,
            textColor: COLORS.white,
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'center'
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            // Right-align numeric columns (usually the last few)
            ...(columns.length > 3 ? {
                [columns.length - 1]: { halign: 'right' },
                [columns.length - 2]: { halign: 'right' },
                [columns.length - 3]: { halign: 'right' }
            } : {})
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
            // Footer on every page
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...COLORS.muted);

            const pageNum = doc.internal.getNumberOfPages();
            doc.text(
                `PredioClick — ${title} | Página ${data.pageNumber} de ${pageNum}`,
                pageWidth / 2, pageHeight - 8,
                { align: 'center' }
            );
        }
    });

    // ======== DOWNLOAD ========
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
        const proj = projects.find(p => p.id === sale.projectId);
        const paid = getPaymentsBySale(sale.id).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
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
    const totalPaid = filteredSales.reduce((sum, s) => {
        return sum + getPaymentsBySale(s.id).reduce((p, pay) => p + parseFloat(pay.amount || 0), 0);
    }, 0);

    exportReportToPDF({
        title: 'Reporte de Ventas',
        subtitle: `${filteredSales.length} ventas registradas`,
        columns,
        data,
        stats: [
            { label: 'Total Ventas', value: filteredSales.length },
            { label: 'Valor Total', value: formatCurrency(totalSales) },
            { label: 'Recaudado', value: formatCurrency(totalPaid) },
            { label: 'Pendiente', value: formatCurrency(totalSales - totalPaid) }
        ],
        filename: 'ventas',
        period,
        project
    });
}

/**
 * Export payments report
 */
export function exportPaymentsPDF(filteredPayments, sales, clients, projects, formatCurrency, formatDate, period, project) {
    const columns = ['Fecha', 'Cliente', 'Proyecto', 'Lote', 'Monto'];

    const data = filteredPayments.map(payment => {
        const sale = sales.find(s => s.id === payment.saleId);
        const client = sale ? clients.find(c => c.id === sale.clientId) : null;
        const proj = sale ? projects.find(p => p.id === sale.projectId) : null;

        return [
            formatDate(payment.paymentDate || payment.createdAt),
            client?.name || client?.fullName || '',
            proj?.name || '',
            sale?.lotNumber || '',
            formatCurrency(payment.amount)
        ];
    });

    const totalPayments = filteredPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    exportReportToPDF({
        title: 'Reporte de Pagos',
        subtitle: `${filteredPayments.length} pagos registrados`,
        columns,
        data,
        stats: [
            { label: 'Total Pagos', value: filteredPayments.length },
            { label: 'Monto Total', value: formatCurrency(totalPayments) }
        ],
        filename: 'pagos',
        period,
        project
    });
}

/**
 * Export expenses report
 */
export function exportExpensesPDF(filteredExpenses, projects, categoryLabels, formatCurrency, formatDate, period, project) {
    const columns = ['Fecha', 'Proyecto', 'Categoría', 'Descripción', 'Monto'];

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
        columns,
        data,
        stats: [
            { label: 'Total Gastos', value: filteredExpenses.length },
            { label: 'Monto Total', value: formatCurrency(totalExpenses) }
        ],
        filename: 'gastos',
        period,
        project
    });
}

/**
 * Export agent performance report
 */
export function exportAgentsPDF(agentPerformance, formatCurrency, period, project) {
    const columns = ['Comisionista', 'Proyectos', 'Ventas', 'Total Vendido', 'Comisión', 'Recaudado', 'Pendiente'];

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
        columns,
        data,
        stats: [
            { label: 'Comisionistas', value: agentPerformance.length },
            { label: 'Total Ventas', value: agentPerformance.reduce((s, a) => s + a.salesCount, 0) },
            { label: 'Total Vendido', value: formatCurrency(agentPerformance.reduce((s, a) => s + a.totalRevenue, 0)) },
            { label: 'Total Comisiones', value: formatCurrency(agentPerformance.reduce((s, a) => s + a.commissionTotal, 0)) }
        ],
        filename: 'comisionistas',
        period,
        project
    });
}
