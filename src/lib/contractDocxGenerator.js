/**
 * LoteClick - Contract DOCX Generator (JVJ Constructores)
 * Genera promesas de compraventa de cuota parte en formato .docx
 * Usa la librería 'docx' (https://docx.js.org)
 */
import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, HeadingLevel, ShadingType,
    PageOrientation, convertInchesToTwip, TabStopType, TabStopPosition,
    UnderlineType, VerticalAlign, ImageRun
} from 'docx';
import { saveAs } from 'file-saver';
import { brand } from '../config/brandConfig';
import { loadImageAsBase64 } from './logoLoader';

// ─── Helpers ─────────────────────────────────────────────────────

function numberToWords(n) {
    const units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    if (n === 0) return 'CERO';
    if (n === 100) return 'CIEN';
    let result = '';
    if (n >= 1000000) {
        const m = Math.floor(n / 1000000);
        result += (m === 1 ? 'UN MILLÓN ' : numberToWords(m) + ' MILLONES ');
        n %= 1000000;
    }
    if (n >= 1000) {
        const t = Math.floor(n / 1000);
        result += (t === 1 ? 'MIL ' : numberToWords(t) + ' MIL ');
        n %= 1000;
    }
    if (n >= 100) {
        result += hundreds[Math.floor(n / 100)] + ' ';
        n %= 100;
    }
    if (n >= 20) {
        const t = Math.floor(n / 10), u = n % 10;
        result += (t === 2 && u > 0) ? 'VEINTI' + units[u] : tens[t] + (u > 0 ? ' Y ' + units[u] : '');
    } else if (n >= 10) {
        result += teens[n - 10];
    } else if (n > 0) {
        result += units[n];
    }
    return result.trim();
}

function priceInWords(amount) {
    const n = Math.round(parseFloat(amount) || 0);
    return `${numberToWords(n)} PESOS M/CT ($${n.toLocaleString('es-CO')})`;
}

function formatDateSimple(dateStr) {
    if (!dateStr) return '_______________';
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const d = new Date(dateStr + 'T12:00:00');
    return `${String(d.getDate()).padStart(2, '0')} de ${months[d.getMonth()]} del ${d.getFullYear()}`;
}

function formatDateLongSpanish(dateStr) {
    if (!dateStr) return '_______________';
    const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const d = new Date(dateStr + 'T12:00:00');
    return `${numberToWords(d.getDate())} (${String(d.getDate()).padStart(2, '0')}) días del mes de ${months[d.getMonth()]} DE ${d.getFullYear()}`;
}

function calculateStartDate(saleDate) {
    if (!saleDate) return '_______________';
    const d = new Date(saleDate + 'T12:00:00');
    d.setMonth(d.getMonth() + 1);
    return formatDateSimple(d.toISOString().split('T')[0]);
}

function calculateEndDate(saleDate, numInstallments) {
    if (!saleDate || !numInstallments) return '_______________';
    const d = new Date(saleDate + 'T12:00:00');
    d.setMonth(d.getMonth() + parseInt(numInstallments));
    return formatDateSimple(d.toISOString().split('T')[0]);
}

// ─── Text helpers ─────────────────────────────────────────────────

const FONT = 'Times New Roman';
const FONT_SIZE = 20; // half-points (10pt)
const FONT_SIZE_SM = 18; // 9pt
const FONT_SIZE_TITLE = 24; // 12pt

function txt(text, opts = {}) {
    return new TextRun({
        text,
        font: FONT,
        size: opts.size || FONT_SIZE,
        bold: opts.bold || false,
        underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
        italics: opts.italics || false,
        color: opts.color || '000000',
    });
}

function para(children, opts = {}) {
    const items = Array.isArray(children) ? children : [typeof children === 'string' ? txt(children) : children];
    return new Paragraph({
        children: items,
        alignment: opts.align || AlignmentType.JUSTIFIED,
        spacing: { after: opts.spacingAfter ?? 120, before: opts.spacingBefore ?? 0, line: 276, lineRule: 'auto' },
        indent: opts.indent ? { left: convertInchesToTwip(0.3) } : undefined,
    });
}

function boldPara(text, opts = {}) {
    return para([txt(text, { bold: true, size: opts.size })], { align: opts.align || AlignmentType.CENTER, ...opts });
}

function clausePara(title, body) {
    return para([
        txt(title, { bold: true }),
        txt(' ' + body),
    ], { align: AlignmentType.JUSTIFIED, spacingAfter: 160 });
}

function emptyLine() {
    return new Paragraph({ children: [new TextRun('')], spacing: { after: 80 } });
}

function noBorder() {
    return { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } };
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────

export async function generateContractDocx({ sale, client, project, lot, contractParams, promesaNumber }) {
    const cp = contractParams || {};

    // — Datos —
    const salePrice = parseFloat(sale.totalPrice || sale.sale_price || 0);
    const downPayment = parseFloat(sale.downPayment || sale.down_payment || 0);
    const numInstallments = parseInt(sale.numberOfInstallments || sale.installments || 1);
    const financedAmount = salePrice - downPayment;
    const monthlyPayment = numInstallments > 0 ? Math.round(financedAmount / numInstallments) : 0;
    const penaltyAmount = Math.round(salePrice * 0.20);
    const saleDate = sale.saleDate || sale.sale_date || '';
    const lotNumber = sale.lotNumber || lot?.number || '';
    const lotManzana = sale.lotManzana || sale.lot_manzana || lot?.manzana || '';
    const lotEtapa = sale.lotEtapaName || sale.lot_etapa_name || '';
    const lotArea = lot?.area || '___';
    const promNum = String(promesaNumber || 0).padStart(3, '0');

    // Comprador
    const clientName = (client?.name || client?.fullName || '').toUpperCase();
    const clientDoc = client?.document || '_______________';
    const clientPhone = client?.phone || '_______________';
    const clientEmail = client?.email || '';
    const clientAddress = client?.address || '';

    // Vendedor / Empresa
    const vendorName = (cp.vendor_name || cp.vendorName || '').toUpperCase();
    const vendorDoc = cp.vendor_document || cp.vendorDocument || '_______________';
    const vendorPhone = cp.vendor_phone || cp.vendorPhone || '_______________';
    const vendorAddress = cp.vendor_address || cp.vendorAddress || '';
    const vendorEmail = cp.vendor_email || cp.vendorEmail || '';
    const vendorCiudadCC = cp.vendor_ciudad_cc || cp.vendorCiudadCC || '';
    const empresaNombre = (cp.empresa_nombre || cp.empresaNombre || '').toUpperCase();
    const empresaNit = cp.empresa_nit || cp.empresaNit || '';
    const numeroCuenta = cp.numero_cuenta || cp.numeroCuenta || '';

    // Inmueble
    const matricula = cp.matricula_inmobiliaria || cp.matriculaInmobiliaria || 'M.I. ___________';
    const porcentaje = cp.porcentaje_cuota || cp.porcentajeCuota || '0.052%';
    const ciudad = cp.ciudad || 'Villavicencio - Meta';
    const ciudadNombre = ciudad.split('-')[0]?.trim() || 'Villavicencio';
    const notaria = cp.notaria_nombre || cp.notariaNombre || '_______________';
    const notariaCiudad = cp.notaria_ciudad || cp.notariaCiudad || ciudadNombre;
    const escrituraFecha = cp.escritura_fecha || cp.escrituraFecha || '';
    const escrituraHora = cp.escritura_hora || cp.escrituraHora || '03:00 PM';
    const tituloPropiedad = cp.titulo_propiedad || cp.tituloPropiedad || '_______________';
    const projectName = (project?.name || '').toUpperCase();

    // Apoderada (opcional)
    const apoderadaNombre = (cp.apoderada_nombre || cp.apoderadaNombre || '').toUpperCase();
    const apoderadaCC = cp.apoderada_cc || cp.apoderadaCC || '';
    const apoderadaCiudad = cp.apoderada_ciudad || cp.apoderadaCiudad || ciudadNombre;

    // ─── Tabla encabezado: Vendedor | Comprador ───────────────────

    const vendorCell = new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: noBorder(),
        children: [
            para([txt(vendorName, { bold: true })], { align: AlignmentType.LEFT, spacingAfter: 40 }),
            para([txt(`C.C ${vendorDoc} DE ${vendorCiudadCC}`)], { spacingAfter: 40 }),
            para([txt(vendorAddress)], { spacingAfter: 40 }),
            para([txt('Actuando en representación Legal')], { spacingAfter: 40 }),
            para([txt(empresaNombre, { bold: true })], { spacingAfter: 40 }),
            para([txt(`NIT: ${empresaNit}`)], { spacingAfter: 40 }),
            para([txt('EL PROMETIENTE VENDEDOR', { bold: true })], { spacingAfter: 40 }),
            para([txt(`CEL: ${vendorPhone}`)], { spacingAfter: 40 }),
            ...(vendorEmail ? [para([txt(`CORREO: ${vendorEmail}`)], { spacingAfter: 40 })] : []),
        ],
    });

    const buyerCell = new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: noBorder(),
        children: [
            para([txt(clientName, { bold: true })], { align: AlignmentType.LEFT, spacingAfter: 40 }),
            para([txt(`C.C ${clientDoc}`)], { spacingAfter: 40 }),
            ...(clientAddress ? [para([txt(`RESIDENCIA: ${clientAddress}`)], { spacingAfter: 40 })] : []),
            para([txt('ACTUANDO EN NOMBRE PROPIO')], { spacingAfter: 40 }),
            para([txt('EL PROMETIENTE COMPRADOR', { bold: true })], { spacingAfter: 40 }),
            para([txt(`CEL: ${clientPhone}`)], { spacingAfter: 40 }),
            ...(clientEmail ? [para([txt(`CORREO: ${clientEmail}`)], { spacingAfter: 40 })] : []),
            ...(apoderadaNombre ? [
                emptyLine(),
                para([txt('APODERADA', { bold: true })], { spacingAfter: 40 }),
                para([txt(apoderadaNombre, { bold: true })], { spacingAfter: 40 }),
                para([txt(`C.C ${apoderadaCC} de ${apoderadaCiudad}`)], { spacingAfter: 40 }),
            ] : []),
        ],
    });

    const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: [vendorCell, buyerCell] })],
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
    });

    // ─── Cláusula CUARTA — Precio ────────────────────────────────

    let cuartaBody = `El precio de la cuota parte es la suma de ${priceInWords(salePrice)} moneda corriente`;

    if (sale.paymentType === 'cash' || sale.payment_type === 'cash') {
        cuartaBody += `, suma que EL PROMITENTE COMPRADOR pagará de contado al PROMITENTE VENDEDOR.`;
    } else {
        const separeAmount = parseFloat(cp.separeAmount || 0);
        let inicioText = '';

        if (separeAmount > 0) {
            const separeDate = cp.separeDate || saleDate;
            const remainingInitial = downPayment - separeAmount;
            inicioText = `a la firma del presente contrato da como cuota ${priceInWords(separeAmount)}`;
            if (remainingInitial > 0) {
                inicioText += `, posteriormente el ${formatDateSimple(saleDate)} efectuó el pago de la cuota inicial por un valor de ${priceInWords(remainingInitial)}`;
            }
        } else {
            inicioText = `a la firma del presente contrato da como cuota inicial ${priceInWords(downPayment)}`;
        }

        const cuentaText = numeroCuenta ? ` en TRANSFERENCIA a la cuenta de AHORROS N°${numeroCuenta}` : '';

        cuartaBody += `, suma que EL PROMITENTE COMPRADOR pagará al PROMITENTE VENDEDOR así: ${inicioText}${cuentaText}, y el saldo de ${priceInWords(financedAmount)} será cancelado en ${numInstallments} ${numInstallments === 1 ? 'cuota mensual' : 'cuotas mensuales'} de ${priceInWords(monthlyPayment)} a partir del ${calculateStartDate(saleDate)} hasta el ${calculateEndDate(saleDate, numInstallments)}.`;
    }

    const paragrafoCuarta = `\n\nPARAGRAFO. Así mismo, las partes declaran que conocen el texto y alcance del artículo 61 de la ley 2010 del 27 de diciembre de 2019, por lo que BAJO LA GRAVEDAD DEL JURAMENTO que se entiende prestado por el solo hecho de la firma, expresan QUE EL PRECIO incluido en este documento es REAL y que no ha sido objeto de pactos privados en los que se señale un valor diferente. Sin las referidas declaraciones, tanto el impuesto sobre la renta como la ganancia ocasional, el impuesto de registro, los derechos de registro y los derechos notariales, serán liquidados sobre una base equivalente a cuatro (4) veces el valor incluido en la escritura, sin perjuicio de la obligación del notario de reportar la irregularidad a las autoridades de impuestos. PARÁGRAFO CLAUSULA PENAL: Las partes pactan como cláusula penal a cargo de quien incumpla la suma de ${priceInWords(penaltyAmount)}, equivalente al 20% del valor total de esta negociación.`;

    // ─── Tabla de firmas ────────────────────────────────────────

    function signatureCell(name, doc2, phone, role) {
        return new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorder(),
            children: [
                new Paragraph({
                    children: [new TextRun({ text: '', font: FONT })],
                    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
                    spacing: { before: 1200, after: 80 },
                }),
                para([txt(name, { bold: true })], { align: AlignmentType.LEFT, spacingAfter: 40 }),
                para([txt(`C.C ${doc2}`)], { spacingAfter: 40 }),
                para([txt(`CEL: ${phone}`)], { spacingAfter: 40 }),
                para([txt(role, { bold: true })], { spacingAfter: 40 }),
            ],
        });
    }

    const sigTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({
            children: [
                signatureCell(vendorName, vendorDoc, vendorPhone, 'EL PROMITENTE VENDEDOR'),
                signatureCell(clientName, clientDoc, clientPhone, 'EL PROMITENTE COMPRADOR'),
            ]
        })],
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
    });

    // Load logos for embedding (fully error-safe)
    let logoChildren = [];
    try {
        const projectLogoUrl = project?.logo_url || project?.logoUrl || null;
        const logoUrl = projectLogoUrl || brand.logo;
        if (logoUrl) {
            const fullUrl = logoUrl.startsWith('http') ? logoUrl : `${window.location.origin}${logoUrl}`;
            const response = await fetch(fullUrl);
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                logoChildren = [
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: new Uint8Array(buffer),
                                transformation: { width: 120, height: 60 },
                            })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 100 }
                    })
                ];
            }
        }
    } catch(e) { console.warn('Logo DOCX skipped:', e.message); }

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: convertInchesToTwip(1),
                        bottom: convertInchesToTwip(1),
                        left: convertInchesToTwip(1.2),
                        right: convertInchesToTwip(1.2),
                    },
                },
            },
            children: [
                // ── Logo
                ...logoChildren,
                // ── Título
                boldPara('CONTRATO DE PROMESA DE COMPRAVENTA CUOTA PARTE', { size: FONT_SIZE_TITLE, spacingAfter: 40 }),
                boldPara(projectName || matricula, { size: FONT_SIZE_TITLE, spacingAfter: 200 }),
                boldPara(`PROMESA N°${promNum}`, { size: FONT_SIZE, spacingAfter: 200 }),

                // ── Encabezado de partes
                headerTable,
                emptyLine(),

                // ── Preámbulo
                para([txt('Las partes antes referenciadas manifiestan que han decidido celebrar un '),
                    txt('CONTRATO DE PROMESA DE COMPRAVENTA DE CUOTA PARTE', { bold: true }),
                    txt(', en adelante la "Promesa", la que se regirá por las siguientes:')],
                    { spacingAfter: 160 }),

                // ── Cláusulas
                clausePara('PRIMERA. – OBJETO:', `El promitente Vendedor promete vender al Promitente Comprador y este promete comprar el inmueble rural en cuotas partes del derecho de dominio, propiedad y posesión. PARAGRAFO PRIMERO: Inmueble identificado con matrícula inmobiliaria No. ${matricula}. PARAGRAFO SEGUNDO: La cuota parte objeto de esta compraventa equivale al ${porcentaje} (correspondiente a una extensión superficiaria de ${lotArea} metros cuadrados). PARAGRAFO TERCERO: El promitente comprador manifiesta conocer las reglamentaciones de urbanismo, medio ambiente y demás normativas aplicables al inmueble, renuncia a cualquier proceso de reclamación o indemnización ante el promitente vendedor por estos motivos.`),

                clausePara('SEGUNDA. – TÍTULO:', tituloPropiedad || `El Inmueble fue adquirido por el Promitente Vendedor mediante escritura pública. Y manifiesta que confiere al señor ${vendorName} identificado con C.C: ${vendorDoc}, el título de propiedad para realizar los respectivos actos de compra y venta del suscrito predio.`),

                clausePara('TERCERA. – POSESIÓN Y LIBERTAD:', `EL PROMITENTE VENDEDOR declara que posee real y materialmente el inmueble objeto de esta venta. Garantiza que lo posee en forma regular, pacífica y pública y que el mismo se halla libre de servidumbres, usufructo, uso, arrendamiento por escritura pública, movilización, patrimonio de familia, afectación a vivienda familiar y en general libre de todo gravamen, embargo, condición resolutoria y limitación de dominio distintas de las enunciadas.`),

                clausePara('CUARTA: PRECIO –', cuartaBody + paragrafoCuarta),

                clausePara('QUINTA. – PLAZO:', `LA ESCRITURA PÚBLICA QUE CONTENDRÁ EL CONTRATO DE COMPRAVENTA DE CUOTA PARTE, SERÁ OTORGADA EN LA ${notaria.toUpperCase()}, EL ${escrituraFecha ? formatDateSimple(escrituraFecha).toUpperCase() : '_______________'}, PARA EFECTOS CONTRACTUALES SE FIJA LA HORA ${escrituraHora}.`),

                clausePara('SEXTA. – GASTOS ADMINISTRATIVOS, IMPUESTOS Y CONTRIBUCIONES:', `Se conviene que los impuestos y contribuciones que se causen con posterioridad a la fecha de escrituración estarán a cargo exclusivo de EL PROMITENTE COMPRADOR, así como cualquier gasto administrativo derivado de la administración del inmueble (servicios públicos, administraciones, vigilancias, etc.) a partir de la fecha de entrega material.`),

                clausePara('SÉPTIMA. – PRÓRROGA:', `El plazo para la celebración del contrato prometido podrá prorrogarse de común acuerdo por las partes, lo cual deberá constar por escrito.`),

                clausePara('OCTAVA. – ENTREGA:', `En la fecha de otorgamiento del presente documento el Promitente Vendedor se obliga a: (i) Entregar el Inmueble libre de embargos, pleitos pendientes, demandas civiles, gravámenes y patrimonio de familia, (ii) en paz y salvo por servicios públicos e impuestos, y (iii) salir al saneamiento de la venta. PARAGRAFO: La cuota parte de terreno se entrega con servidumbre interna de vías de uso común y redes de energía eléctrica de uso privado. Los gastos de instalación de energía eléctrica son a cargo del COMPRADOR. Adicionalmente se entrega un punto de agua sin costo adicional de instalación para el COMPRADOR.`),

                clausePara('NOVENA. – GASTOS NOTARIALES Y DE REGISTRO:', `Los gastos notariales serán sufragados por partes iguales. Los gastos de boleta fiscal y registro, incluyendo el impuesto de registro, serán por cuenta del PROMITENTE COMPRADOR. Los gastos de retención en la fuente serán asumidos por el PROMITENTE VENDEDOR.`),

                clausePara('DÉCIMA. – MÉRITO EJECUTIVO:', `Las partes declaran que este documento presta mérito ejecutivo para la efectividad de las obligaciones en él contenidas.`),

                clausePara('DÉCIMA PRIMERA. – DECLARACIÓN DE ORIGEN DE FONDOS:', `Las partes manifiestan que el origen de los dineros proceden del giro ordinario de actividades lícitas, y que los recursos no provienen de ninguna actividad ilícita contemplada en el Código Penal Colombiano.`),

                clausePara('DÉCIMA SEGUNDA. – CESIÓN:', `Las partes se comprometen a no ceder parcial ni totalmente las obligaciones contenidas en el presente contrato, sin autorización previa y por escrito del contratante cedido.`),

                emptyLine(),
                para([txt(`Para constancia, el presente contrato se firma en la ciudad de ${ciudadNombre}, al ${formatDateLongSpanish(saleDate)}, en dos (2) ejemplares del mismo valor, cada uno con destino a cada una de las partes.`)],
                    { align: AlignmentType.JUSTIFIED, spacingAfter: 300 }),

                // ── Firmas
                sigTable,

                // ── PÁGINA 2: ANEXO 1 ──────────────────────────────────
                new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }),

                boldPara('ANEXO 1', { size: FONT_SIZE_TITLE, spacingAfter: 40 }),
                boldPara('SEPARACIÓN CUOTA PARTE', { size: FONT_SIZE, spacingAfter: 40 }),
                boldPara(matricula, { size: FONT_SIZE_SM, spacingAfter: 40 }),
                boldPara(`${ciudadNombre.toUpperCase()} – META`, { size: FONT_SIZE_SM, spacingAfter: 40 }),
                boldPara(`PROMESA N°${promNum}`, { size: FONT_SIZE_SM, spacingAfter: 200 }),

                // Partes en Anexo
                para([txt(vendorName, { bold: true })], { spacingAfter: 40 }),
                para([txt(`C.C. ${vendorDoc}`)], { spacingAfter: 40 }),
                para([txt(`CEL: ${vendorPhone}`)], { spacingAfter: 40 }),
                para([txt('EL PROMITENTE VENDEDOR', { bold: true })], { spacingAfter: 120 }),

                para([txt(clientName, { bold: true })], { spacingAfter: 40 }),
                para([txt(`C.C: ${clientDoc}`)], { spacingAfter: 40 }),
                para([txt(`CEL: ${clientPhone}`)], { spacingAfter: 40 }),
                para([txt('EL PROMITENTE COMPRADOR', { bold: true })], { spacingAfter: 120 }),

                para([
                    txt('Las partes antes referenciadas manifestaron que han celebrado un '),
                    txt('CONTRATO DE PROMESA DE COMPRAVENTA DE CUOTA PARTE', { bold: true }),
                    txt(`, sobre el bien inmueble allí descrito, equivalente al ${porcentaje} que hace referencia a una extensión superficiaria de ${lotArea} metros cuadrados, correspondiente al LOTE No.${lotNumber}${lotManzana ? ` de la Manzana ${lotManzana}` : ''}${lotEtapa ? `, ${lotEtapa}` : ''} del proyecto `),
                    txt(`"${projectName}"`, { bold: true }),
                    txt(' como consta en el plano topográfico del proyecto.'),
                ], { spacingAfter: 300 }),

                sigTable,
            ],
        }],
    });

    const blob = await Packer.toBlob(doc);
    const filename = `Contrato_N${promNum}_Lote${lotNumber}_${clientName.replace(/\s+/g, '_')}.docx`;
    saveAs(blob, filename);
    return filename;
}

export async function generateArrasDocx(sale, project, lot, client, acometidaValue = 8700000, contractParams = {}) {
    const cp = contractParams || {};
    const representante = (cp.vendor_name || cp.vendorName || '').toUpperCase();
    const empresaDoc = (cp.empresa_nombre || cp.empresaNombre || '').toUpperCase();
    const docCC = cp.vendor_document || cp.vendorDocument || 'N/A';
    const docPhone = cp.vendor_phone || cp.vendorPhone || 'N/A';
    const doc = new Document({
        creator: 'LoteClick',
        title: 'Arras de Separación',
        styles: {
            default: { document: { run: { font: FONT, size: FONT_SIZE } } }
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: convertInchesToTwip(1), right: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1) }
                }
            },
            children: [
                para([txt(`Acacias, Meta ${formatDateLongSpanish(sale.saleDate)}`, { bold: true })], { spacingAfter: 300 }),
                boldPara('CONSTANCIA DE ABONO ARRAS DE SEPARACION', { size: FONT_SIZE_TITLE, spacingAfter: 300, align: AlignmentType.CENTER }),
                para([
                    txt('Yo, '), txt(representante || 'EL REPRESENTANTE LEGAL', { bold: true }), txt(', identificado como aparece al pie de mi firma, hago constar que el(la) señor(a) '),
                    txt(client.name || client.fullName, { bold: true }), txt(` identificado(a) con cedula N° ${client.document}, celular ${client.phone} realiza el `),
                    txt('ABONO A LA SEPARACION', { bold: true }), txt(` de la compraventa de UN (1) lote al porcentaje denominado N° ${lot.number} de la ${getManzanaLabel(lot.number, project)} del `),
                    txt(`PROYECTO ${project.name}`, { bold: true }), txt(', que hace parte de un terreno de mayor área distinguido en el plano como LA CAROLINA ubicado en la VEREDA EL RESGUARDO, jurisdicción rural del Municipio de Acacias Meta, identificado catastralmente con el número 00-02- 0014-0011-000 (mayor área). Con la suma de '),
                    txt(priceInWords(acometidaValue), { bold: true }), txt(' en TRANSFERENCIA a la cuenta ahorros de Bancolombia N° 38800007636 por concepto de venta de un lote por la SUMA DE '),
                    txt(priceInWords(sale.totalPrice), { bold: true })
                ], { spacingAfter: 300, align: AlignmentType.JUSTIFIED }),
                para([txt('NOTA 1: ESTAS ARRAS DE SEPARACIÓN NO SON DEVOLUTIVAS AL DADO CASO QUE NO DÉ EN COMÚN ACUERDO DICHO NEGOCIO DE SEPARACIÓN DE LOTE DE TERRENO RURAL AL PORCENTAJE.', { bold: true })], { spacingAfter: 200 }),
                para([txt('NOTA 2: ARRAS VALIDAS HASTA EL ' + calculateStartDate(sale.saleDate), { bold: true })], { spacingAfter: 600 }),
                para([txt('Asesor de ventas: _____________')], { spacingAfter: 200 }),
            ]
        }]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Arras_${client.name || client.fullName}.docx`);
}

export async function generateConstanciaComisionDocx(sale, project, lot, client, commissionAmount = 5000000, agentName = '', contractParams = {}) {
    const cp = contractParams || {};
    const representante = (cp.vendor_name || cp.vendorName || '').toUpperCase();
    const doc = new Document({
        creator: 'LoteClick',
        title: 'Constancia Pago de Comisión',
        styles: {
            default: { document: { run: { font: FONT, size: FONT_SIZE } } }
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: convertInchesToTwip(1), right: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1) }
                }
            },
            children: [
                para([txt(`Acacias – Meta ${formatDateSimple(sale.saleDate)}`, { bold: true })], { spacingAfter: 300 }),
                boldPara('CONSTANCIA DE PAGO DE COMISION DE LOTE', { size: FONT_SIZE_TITLE, spacingAfter: 300, align: AlignmentType.CENTER }),
                para([
                    txt('Yo '), txt(representante || 'EL REPRESENTANTE LEGAL', { bold: true }), txt(` identificado como aparezco al pie de mi firma, dejo constancia que el día ${formatDateSimple(sale.saleDate)} abono comisión a el(la) señor(a) `),
                    txt(agentName, { bold: true }), txt(`, correspondiente AL LOTE N°${lot.number} por la suma `),
                    txt(priceInWords(commissionAmount), { bold: true }), txt(' correspondiente al abono comisión.')
                ], { spacingAfter: 300, align: AlignmentType.JUSTIFIED }),
                para([txt('NOTA 1: RECIBO SATISFACTORIAMENTE EL DINERO DEL PAGO DE LA COMISION.', { bold: true })], { spacingAfter: 200 }),
                para([txt('NOTA 2: SI POR ALGUNA RAZON SE RETRACTA EL NEGOCIO DE DICHA VENTA DEBO DAR DEVOLUCION DE LA MITAD DEL DINERO RECIBIDO', { bold: true })], { spacingAfter: 600 }),
                para([txt('Atentamente,')], { spacingAfter: 800 }),
                para([txt('______________________________')]),
                para([txt(agentName, { bold: true })]),
            ]
        }]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Comision_${lot.number}.docx`);
}

export async function generatePazYSalvoDocx(sale, project, lot, client, contractParams = {}) {
    const cp = contractParams || {};
    const representante = (cp.vendor_name || cp.vendorName || '').toUpperCase();
    const doc = new Document({
        creator: 'LoteClick',
        title: 'Paz y Salvo',
        styles: {
            default: { document: { run: { font: FONT, size: FONT_SIZE } } }
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: convertInchesToTwip(1), right: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1) }
                }
            },
            children: [
                para([txt(`Acacias, Meta ${formatDateSimple(new Date().toISOString().split('T')[0])}`, { bold: true })], { spacingAfter: 300 }),
                boldPara('CONSTANCIA PAZ Y SALVO', { size: FONT_SIZE_TITLE, spacingAfter: 300, align: AlignmentType.CENTER }),
                para([
                    txt('Yo, '), txt(representante || 'EL REPRESENTANTE LEGAL', { bold: true }), txt(', identificado como aparece al pie de mi firma, hago constar que el(la) señor(a), '),
                    txt(client.name || client.fullName, { bold: true }), txt(` identificado(a) con cedula de ciudadanía N° ${client.document}, `),
                    txt('REALIZA EL PAGO TOTAL', { bold: true }), txt(` el día ${formatDateSimple(new Date().toISOString().split('T')[0])} de la compraventa de UN (1) lote al porcentaje denominado N° ${lot.number} de la ${getManzanaLabel(lot.number, project)} del `),
                    txt(`PROYECTO ${project.name}`, { bold: true }), txt(', encontrándose así a '), txt('PAZ Y SALVO', { bold: true }),
                    txt(', que hace parte de un terreno de mayor área distinguido en el plano como LA CAROLINA ubicado en la VEREDA EL RESGUARDO, jurisdicción rural del Municipio de Acacias Meta, identificado catastralmente con el número 00-02-014-0011-000 (mayor área).')
                ], { spacingAfter: 600, align: AlignmentType.JUSTIFIED }),
                para([txt('Atentamente,')], { spacingAfter: 800 }),
                para([txt('______________________________')]),
                para([txt(representante || 'EL REPRESENTANTE LEGAL', { bold: true })]),
                para([txt('C.C.')]),
            ]
        }]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `PazYSalvo_${client.name || client.fullName}.docx`);
}

function getManzanaLabel(lotNum, proj) {
    if (proj?.blocks) {
        for (const block of proj.blocks) {
            const rangeParts = block.lot_range?.split('-') || [];
            if (rangeParts.length === 2 && parseInt(lotNum) >= parseInt(rangeParts[0]) && parseInt(lotNum) <= parseInt(rangeParts[1])) {
                return `Manzana ${block.name}`;
            }
        }
    }
    return `Manzana ${proj?.manzana || ''}`;
}

/**
 * Genera Constancia de Cuota Inicial (confirma que el cliente pagó la cuota inicial/enganche)
 */
export async function generateConstanciaCuotaInicialDocx(sale, project, lot, client, downPaymentAmount, contractParams = {}) {
    const amount = parseFloat(downPaymentAmount || sale.downPayment || sale.down_payment || 0);
    const cp = contractParams || {};
    const representante = (cp.vendor_name || cp.vendorName || '').toUpperCase();
    const empresaDocNombre = (cp.empresa_nombre || cp.empresaNombre || '').toUpperCase();
    const empresaDocNit = cp.empresa_nit || cp.empresaNit || '';
    const doc = new Document({
        creator: 'LoteClick',
        title: 'Constancia Cuota Inicial',
        styles: {
            default: { document: { run: { font: FONT, size: FONT_SIZE } } }
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: convertInchesToTwip(1), right: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1) }
                }
            },
            children: [
                para([txt(`Acacias, Meta ${formatDateLongSpanish(new Date().toISOString().split('T')[0])}`, { bold: true })], { spacingAfter: 300 }),
                boldPara('CONSTANCIA DE PAGO CUOTA INICIAL', { size: FONT_SIZE_TITLE, spacingAfter: 300, align: AlignmentType.CENTER }),
                para([
                    txt('Yo, '), txt(representante || 'EL REPRESENTANTE LEGAL', { bold: true }), txt(', identificado como aparece al pie de mi firma, en calidad de representante legal de '),
                    txt(empresaDocNombre || '', { bold: true }), txt(', hago constar que el(la) señor(a) '),
                    txt((client.name || client.fullName || '').toUpperCase(), { bold: true }), txt(` identificado(a) con cédula de ciudadanía N° ${client.document}, celular ${client.phone || 'N/A'}, `),
                    txt('HA REALIZADO EL PAGO DE LA CUOTA INICIAL', { bold: true }), txt(` correspondiente a la compraventa del LOTE N° ${lot?.number || sale.lotNumber || 'N/A'} de la ${getManzanaLabel(lot?.number || sale.lotNumber, project)} del `),
                    txt(`PROYECTO ${(project?.name || '').toUpperCase()}`, { bold: true }), txt(', por la suma de '),
                    txt(priceInWords(amount), { bold: true }), txt('. ')
                ], { spacingAfter: 200, align: AlignmentType.JUSTIFIED }),
                para([
                    txt('El valor total de la compraventa asciende a la suma de '),
                    txt(priceInWords(sale.totalPrice || sale.sale_price), { bold: true }),
                    txt('. Con el presente pago de cuota inicial, el saldo restante es de '),
                    txt(priceInWords((parseFloat(sale.totalPrice || sale.sale_price || 0) - amount)), { bold: true }),
                    txt(', el cual será cancelado conforme a las condiciones pactadas en el contrato de promesa de compraventa.')
                ], { spacingAfter: 300, align: AlignmentType.JUSTIFIED }),
                para([txt('La presente constancia se expide a solicitud del interesado para los fines que estime convenientes.')], { spacingAfter: 600 }),
                para([txt('Atentamente,')], { spacingAfter: 800 }),
                para([txt('______________________________')]),
                para([txt(representante || 'EL REPRESENTANTE LEGAL', { bold: true })]),
                para([txt('Representante Legal')]),
                para([txt(empresaDocNombre || '')]),
            ]
        }]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Constancia_CuotaInicial_Lote${lot?.number || ''}_${(client.name || client.fullName || '').replace(/\s+/g, '_')}.docx`);
}

/**
 * Genera Constancia de Abono a Cuota (recibo de un pago/abono parcial a cuota)
 */
export async function generateAbonoACuotaDocx(sale, project, lot, client, payment, installmentLabel, contractParams = {}) {
    const paymentAmount = parseFloat(payment?.amount || 0);
    const cuotaLabel = installmentLabel || 'Abono a cuota';
    const paymentDate = payment?.paymentDate || payment?.payment_date || new Date().toISOString().split('T')[0];
    const cp = contractParams || {};
    const representante = (cp.vendor_name || cp.vendorName || '').toUpperCase();
    const empresaDocNombre = (cp.empresa_nombre || cp.empresaNombre || '').toUpperCase();
    
    const doc = new Document({
        creator: 'LoteClick',
        title: 'Constancia de Abono a Cuota',
        styles: {
            default: { document: { run: { font: FONT, size: FONT_SIZE } } }
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: convertInchesToTwip(1), right: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1) }
                }
            },
            children: [
                para([txt(`Acacias, Meta ${formatDateLongSpanish(paymentDate)}`, { bold: true })], { spacingAfter: 300 }),
                boldPara('CONSTANCIA DE ABONO A CUOTA', { size: FONT_SIZE_TITLE, spacingAfter: 300, align: AlignmentType.CENTER }),
                para([
                    txt('Yo, '), txt('CAMILO HUBERTO ESCOBAR MORALES', { bold: true }), txt(', identificado como aparece al pie de mi firma, en calidad de representante legal de '),
                    txt('J.V.J CONSTRUCTORES INMOBILIARIOS', { bold: true }), txt(', hago constar que el(la) señor(a) '),
                    txt((client.name || client.fullName || '').toUpperCase(), { bold: true }), txt(` identificado(a) con cédula de ciudadanía N° ${client.document}, `),
                    txt(`ha realizado un ABONO correspondiente a "${cuotaLabel}"`, { bold: true }),
                    txt(` del LOTE N° ${lot?.number || sale.lotNumber || 'N/A'} de la ${getManzanaLabel(lot?.number || sale.lotNumber, project)} del `),
                    txt(`PROYECTO ${(project?.name || '').toUpperCase()}`, { bold: true }), txt('.')
                ], { spacingAfter: 200, align: AlignmentType.JUSTIFIED }),

                boldPara('DETALLE DEL PAGO', { size: FONT_SIZE, spacingAfter: 120, align: AlignmentType.LEFT }),

                new Table({
                    width: { size: 80, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({ children: [
                            new TableCell({ children: [para([txt('Concepto:', { bold: true })])], width: { size: 35, type: WidthType.PERCENTAGE } }),
                            new TableCell({ children: [para([txt(cuotaLabel)])] })
                        ]}),
                        new TableRow({ children: [
                            new TableCell({ children: [para([txt('Monto Abonado:', { bold: true })])] }),
                            new TableCell({ children: [para([txt(priceInWords(paymentAmount), { bold: true })])] })
                        ]}),
                        new TableRow({ children: [
                            new TableCell({ children: [para([txt('Fecha de Pago:', { bold: true })])] }),
                            new TableCell({ children: [para([txt(formatDateSimple(paymentDate))])] })
                        ]}),
                        new TableRow({ children: [
                            new TableCell({ children: [para([txt('Forma de Pago:', { bold: true })])] }),
                            new TableCell({ children: [para([txt((payment?.paymentMethod || payment?.payment_method || 'Efectivo').toUpperCase())])] })
                        ]}),
                        ...(payment?.notes ? [new TableRow({ children: [
                            new TableCell({ children: [para([txt('Observaciones:', { bold: true })])] }),
                            new TableCell({ children: [para([txt(payment.notes)])] })
                        ]})] : []),
                    ]
                }),

                emptyLine(),
                para([
                    txt('Valor total de la compraventa: '), txt(priceInWords(sale.totalPrice || sale.sale_price), { bold: true }), txt('.')
                ], { spacingAfter: 120 }),
                para([txt('La presente constancia se expide como comprobante del abono realizado.')], { spacingAfter: 600 }),
                para([txt('Atentamente,')], { spacingAfter: 800 }),
                para([txt('______________________________')]),
                para([txt(representante || 'EL REPRESENTANTE LEGAL', { bold: true })]),
                para([txt('Representante Legal')]),
                para([txt(empresaDocNombre || '')]),
                emptyLine(),
                para([txt('______________________________')]),
                para([txt((client.name || client.fullName || '').toUpperCase(), { bold: true })]),
                para([txt(`C.C. ${client.document}`)]),
                para([txt('RECIBÍ A SATISFACCIÓN', { bold: true, italics: true })]),
            ]
        }]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Abono_Cuota_Lote${lot?.number || ''}_${(client.name || client.fullName || '').replace(/\s+/g, '_')}.docx`);
}
