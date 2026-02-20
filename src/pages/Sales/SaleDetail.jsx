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
    FiImage
} from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { generatePaymentSlipHTML, printDocument } from '../../lib/barcodeUtils';

function SaleDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const {
        getSaleById,
        deleteSale,
        getClientById,
        getProjectById,
        getPaymentsBySale,
        getTotalPaidBySale,
        getPendingAmount,
        getPendingInstallmentsBySale,
        state
    } = useApp();
    const { isAdmin } = useAuth();

    const sale = getSaleById(id);
    const client = sale ? getClientById(sale.clientId) : null;
    const project = sale ? getProjectById(sale.projectId) : null;
    const payments = sale ? getPaymentsBySale(id) : [];
    const totalPaid = sale ? getTotalPaidBySale(id) : 0;
    const pendingAmount = sale ? getPendingAmount(id) : 0;

    const [showContractModal, setShowContractModal] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState(null);

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
        if (window.confirm('¿Estás seguro de eliminar esta venta? El lote volverá a estar disponible.')) {
            deleteSale(id);
            navigate('/sales');
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const progressPercentage = (totalPaid / parseFloat(sale.totalPrice)) * 100;
    const isPaid = pendingAmount <= 0;

    const generateSimpleContract = () => {
        const contractText = `
CONTRATO DE COMPRAVENTA DE LOTE

Fecha: ${formatDate(sale.saleDate || sale.createdAt)}

VENDEDOR:
${project?.partners?.map(p => `- ${p.name} (${p.percentage}%)`).join('\n') || 'Propietarios del proyecto'}

COMPRADOR:
Nombre: ${client?.name || client?.fullName || 'N/A'}
Documento: ${client?.document || 'N/A'}
Dirección: ${client?.address || 'N/A'}
Teléfono: ${client?.phone || 'N/A'}

OBJETO DEL CONTRATO:
Proyecto: ${project?.name || 'N/A'}
Ubicación: ${project?.location || 'N/A'}
Lote No: ${sale.lotNumber}
${(() => {
                const lot = project?.lots?.find(l => l.id === sale.lotId);
                return lot ? `Área: ${lot.area} m²` : '';
            })()}

PRECIO Y FORMA DE PAGO:
Precio Total: ${formatCurrency(sale.totalPrice)}
Forma de Pago: ${sale.paymentType === 'cash' ? 'Contado' : `${sale.numberOfInstallments} cuotas`}
${sale.downPayment ? `Cuota Inicial: ${formatCurrency(sale.downPayment)}` : ''}

FIRMAS:

_________________________          _________________________
    VENDEDOR                            COMPRADOR
    `;

        return contractText;
    };

    // Función para generar factura HTML imprimible
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
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 3px solid #6366f1; padding-bottom: 20px; }
        .logo { font-size: 28px; font-weight: 700; color: #6366f1; }
        .invoice-info { text-align: right; }
        .invoice-number { font-size: 18px; font-weight: 600; color: #6366f1; }
        .invoice-date { color: #666; margin-top: 5px; }
        .section { margin-bottom: 30px; }
        .section-title { font-size: 14px; text-transform: uppercase; color: #6366f1; font-weight: 600; margin-bottom: 10px; letter-spacing: 1px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .info-box { background: #f8fafc; padding: 20px; border-radius: 8px; }
        .info-box h4 { font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 8px; }
        .info-box p { margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 12px; }
        .total-section { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; border-radius: 8px; margin-top: 30px; }
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
                <div class="logo">🏡 LoteClick</div>
                <p style="color: #666; margin-top: 5px;">Sistema de Gestión de Loteos</p>
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
                            <strong>Lote #${sale.lotNumber}</strong><br>
                            <span style="color: #666; font-size: 13px;">
                                Proyecto: ${project?.name || 'N/A'} - ${project?.location || ''}<br>
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
            <p>Esta factura fue generada automáticamente por LoteClick</p>
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

    // Reprint payment slip with barcode
    const handlePrintReceipt = async () => {
        let installments = [];
        try {
            const { data } = await getPendingInstallmentsBySale(id);
            if (data) installments = data;
        } catch (err) {
            console.error('Error loading installments:', err);
        }
        const html = generatePaymentSlipHTML({ sale, client, project, installments });
        printDocument(html);
    };

    const openReceiptModal = (receiptImage) => {
        setSelectedReceipt(receiptImage);
        setShowReceiptModal(true);
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
                        onClick={() => setShowContractModal(true)}
                    >
                        <FiFileText /> Ver Contrato
                    </button>
                    <Link to={`/payments/new?saleId=${id}`} className="btn btn-primary">
                        <FiPlus /> Registrar Pago
                    </Link>
                </div>
            </div>

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
                            Información del Lote
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
                            <div className="flex-between">
                                <span style={{ color: 'var(--text-muted)' }}>Lote:</span>
                                <span style={{ fontWeight: '600' }}>#{sale.lotNumber}</span>
                            </div>
                            <div className="flex-between">
                                <span style={{ color: 'var(--text-muted)' }}>Precio:</span>
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
                    <Link to={`/payments/new?saleId=${id}`} className="btn btn-primary btn-sm">
                        <FiPlus /> Registrar Pago
                    </Link>
                </div>
                <div className="card-body">
                    {payments.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--spacing-8)' }}>
                            <div className="empty-state-icon">
                                <FiDollarSign />
                            </div>
                            <h3>Sin pagos registrados</h3>
                            <p>Registra el primer pago de esta venta</p>
                            <Link to={`/payments/new?saleId=${id}`} className="btn btn-primary btn-sm">
                                <FiPlus /> Registrar Pago
                            </Link>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Fecha</th>
                                        <th>Monto</th>
                                        <th>Recibo</th>
                                        <th>Notas</th>
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
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Button - Admin only */}
            {isAdmin() && (
                <div className="card mt-6" style={{ borderColor: 'var(--color-error)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <div className="card-body">
                        <div className="flex-between">
                            <div>
                                <h4 style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-1)' }}>Eliminar Venta</h4>
                                <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                                    Esta acción eliminará la venta y marcará el lote como disponible. Los pagos asociados también serán eliminados.
                                </p>
                            </div>
                            <button className="btn btn-danger" onClick={handleDelete}>
                                <FiTrash2 /> Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contract Modal */}
            {showContractModal && (
                <div className="modal-overlay" onClick={() => setShowContractModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Contrato de Compraventa</h3>
                            <button className="modal-close" onClick={() => setShowContractModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <pre style={{
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'monospace',
                                background: 'var(--bg-tertiary)',
                                padding: 'var(--spacing-6)',
                                borderRadius: 'var(--radius-lg)',
                                fontSize: 'var(--font-size-sm)',
                                lineHeight: '1.8'
                            }}>
                                {generateSimpleContract()}
                            </pre>
                            <p style={{
                                marginTop: 'var(--spacing-4)',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-muted)'
                            }}>
                                Nota: Para personalizar este contrato, proporciona el texto del contrato que deseas utilizar.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowContractModal(false)}>
                                Cerrar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    const text = generateSimpleContract();
                                    const blob = new Blob([text], { type: 'text/plain' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `Contrato_Lote${sale.lotNumber}_${(client?.name || client?.fullName)?.replace(/\s/g, '_') || 'Cliente'}.txt`;
                                    a.click();
                                }}
                            >
                                <FiDownload /> Descargar
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
                                src={selectedReceipt}
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
                                href={selectedReceipt}
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
        </div>
    );
}

export default SaleDetail;
