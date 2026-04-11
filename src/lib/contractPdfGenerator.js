/**
 * LoteClick - Contract PDF Generator
 * Genera promesas de compraventa de cuota parte en PDF (2 páginas)
 * Usa jsPDF (ya instalado en el proyecto)
 */
import jsPDF from 'jspdf';
import { brand } from '../config/brandConfig';
import { formatCurrency } from './formatters';

// Helpers
function numberToWords(n) {
    const units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    if (n === 0) return 'CERO';
    if (n === 100) return 'CIEN';

    let result = '';

    if (n >= 1000000) {
        const millions = Math.floor(n / 1000000);
        if (millions === 1) {
            result += 'UN MILLÓN ';
        } else {
            result += numberToWords(millions) + ' MILLONES ';
        }
        n %= 1000000;
    }

    if (n >= 1000) {
        const thousands = Math.floor(n / 1000);
        if (thousands === 1) {
            result += 'MIL ';
        } else {
            result += numberToWords(thousands) + ' MIL ';
        }
        n %= 1000;
    }

    if (n >= 100) {
        if (n === 100) {
            result += 'CIEN';
            return result.trim();
        }
        result += hundreds[Math.floor(n / 100)] + ' ';
        n %= 100;
    }

    if (n >= 20) {
        const t = Math.floor(n / 10);
        const u = n % 10;
        if (t === 2 && u > 0) {
            result += 'VEINTI' + units[u].toLowerCase().toUpperCase();
        } else {
            result += tens[t];
            if (u > 0) result += ' Y ' + units[u];
        }
    } else if (n >= 10) {
        result += teens[n - 10];
    } else if (n > 0) {
        result += units[n];
    }

    return result.trim();
}

function formatDateLongSpanish(dateStr) {
    if (!dateStr) return '_______________';
    const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDate();
    const dayWord = numberToWords(day);
    return `${dayWord} (${String(day).padStart(2, '0')}) días del mes de ${months[d.getMonth()]} DE ${d.getFullYear()}`;
}

function formatDateSimple(dateStr) {
    if (!dateStr) return '_______________';
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const d = new Date(dateStr + 'T12:00:00');
    return `${String(d.getDate()).padStart(2, '0')} de ${months[d.getMonth()]} del ${d.getFullYear()}`;
}

function priceInWords(amount) {
    const n = Math.round(parseFloat(amount) || 0);
    return `${numberToWords(n)} DE PESOS MCTE ($${n.toLocaleString('es-CO')})`;
}

function calculateEndDate(startDate, numInstallments) {
    if (!startDate || !numInstallments) return '_______________';
    const d = new Date(startDate + 'T12:00:00');
    d.setMonth(d.getMonth() + parseInt(numInstallments));
    return formatDateSimple(d.toISOString().split('T')[0]);
}

function calculateStartDate(saleDate) {
    if (!saleDate) return '_______________';
    const d = new Date(saleDate + 'T12:00:00');
    d.setMonth(d.getMonth() + 1);
    return formatDateSimple(d.toISOString().split('T')[0]);
}

/**
 * Main function: Generate the contract PDF
 */
export function generateContractPDF({ sale, client, project, lot, contractParams, promesaNumber }) {
    const doc = new jsPDF('portrait', 'mm', 'letter');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 20;
    const marginRight = 20;
    const contentWidth = pageWidth - marginLeft - marginRight;
    let y = 20;

    const cp = contractParams || {};
    const salePrice = parseFloat(sale.totalPrice || sale.sale_price || 0);
    const downPayment = parseFloat(sale.downPayment || sale.down_payment || 0);
    const numInstallments = parseInt(sale.numberOfInstallments || sale.installments || 1);
    const financedAmount = salePrice - downPayment;
    const monthlyPayment = numInstallments > 0 ? financedAmount / numInstallments : 0;
    const penaltyAmount = Math.round(salePrice * 0.20);
    const penaltyPercent = 20;
    const saleDate = sale.saleDate || sale.sale_date || '';
    const lotNumber = sale.lotNumber || sale.lot_number || '';
    const lotArea = lot?.area || '___';
    const promNum = String(promesaNumber || 0).padStart(3, '0');
    const clientName = (client?.name || client?.fullName || '').toUpperCase();
    const clientDoc = client?.document || '_______________';
    const clientPhone = client?.phone || '_______________';
    const vendorName = (cp.vendor_name || cp.vendorName || '').toUpperCase();
    const vendorDoc = cp.vendor_document || cp.vendorDocument || '_______________';
    const vendorPhone = cp.vendor_phone || cp.vendorPhone || '_______________';
    const vendorAddress = cp.vendor_address || cp.vendorAddress || '';
    const matricula = cp.matricula_inmobiliaria || cp.matriculaInmobiliaria || 'M.I. ___________';
    const porcentaje = cp.porcentaje_cuota || cp.porcentajeCuota || '0.052%';
    const ciudad = cp.ciudad || 'Villavicencio - Meta';
    const notaria = cp.notaria_nombre || cp.notariaNombre || '_______________';
    const escrituraFecha = cp.escritura_fecha || cp.escrituraFecha || '';
    const escrituraHora = cp.escritura_hora || cp.escrituraHora || '03:00 PM';
    const tituloPropiedad = cp.titulo_propiedad || cp.tituloPropiedad || '';
    const projectName = (project?.name || '').toUpperCase();
    const projectLocation = project?.location || ciudad;

    // ============ HELPER: Wrapped text ============
    function addWrappedText(text, x, maxWidth, fontSize, fontStyle = 'normal', lineHeight = 5.5) {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontStyle);
        const lines = doc.splitTextToSize(text, maxWidth);
        for (const line of lines) {
            if (y > pageHeight - 25) {
                doc.addPage();
                y = 20;
            }
            doc.text(line, x, y);
            y += lineHeight;
        }
    }

    function addClause(title, body) {
        if (y > pageHeight - 40) {
            doc.addPage();
            y = 20;
        }
        addWrappedText(title, marginLeft, contentWidth, 9, 'bold', 5);
        y += 1;
        addWrappedText(body, marginLeft, contentWidth, 9, 'normal', 5);
        y += 4;
    }

    // ============ PAGE 1: HEADER ============
    // Logo placeholder bar
    doc.setFillColor(245, 245, 245);
    doc.rect(marginLeft, y - 5, contentWidth, 20, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(marginLeft, y - 5, contentWidth, 20, 'S');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('CONTRATO PROMESA DE COMPRAVENTA DE CUOTA PARTE', pageWidth / 2, y + 2, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`${matricula}`, pageWidth / 2, y + 7, { align: 'center' });
    doc.text(`${ciudad.split('-')[0]?.trim() || 'VILLAVICENCIO'} – ${ciudad.split('-')[1]?.trim() || 'META'}`, pageWidth / 2, y + 12, { align: 'center' });
    y += 22;

    // Promesa Number
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`PROMESA: N°${promNum}`, pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Parties info
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);

    // Vendor column
    doc.setFont('helvetica', 'bold');
    doc.text(vendorName, marginLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`C.C. ${vendorDoc}`, marginLeft, y + 4);
    if (vendorAddress) doc.text(vendorAddress, marginLeft, y + 8);
    doc.text(`Celular: ${vendorPhone}`, marginLeft, y + 12);
    doc.setFont('helvetica', 'bold');
    doc.text('EL PROMITENTE VENDEDOR', marginLeft, y + 18);

    // Buyer column
    const colRight = pageWidth / 2 + 10;
    doc.setFont('helvetica', 'bold');
    doc.text(clientName, colRight, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`C.C: ${clientDoc}`, colRight, y + 4);
    doc.text(`Celular: ${clientPhone}`, colRight, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.text('EL PROMITENTE COMPRADOR', colRight, y + 18);

    y += 26;

    // ============ PREAMBLE ============
    doc.setTextColor(30, 30, 30);
    addWrappedText(
        `Las partes antes referenciadas manifiestan que han decidido celebrar un CONTRATO DE PROMESA DE COMPRAVENTA DE CUOTA PARTE, en adelante la "Promesa", la que se regirá por las siguientes:`,
        marginLeft, contentWidth, 9, 'normal', 5
    );
    y += 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CLÁUSULAS', pageWidth / 2, y, { align: 'center' });
    y += 6;

    // ============ CLAUSES ============

    // PRIMERA - OBJETO
    addClause(
        'PRIMERA. - OBJETO:',
        `El promitente Vendedor promete vender al Promitente Comprador y este promete comprar el inmueble rural, que se describe a continuación, en cuotas partes del derecho de dominio, propiedad y posesión real y materia. PARAGRAFO PRIMERO: inmueble identificado con matrícula inmobiliaria No. ${matricula}, cuyos linderos generales aparecen en la escritura pública 1668 de 2010 de la Notaria CUARTA de Villavicencio. PARAGRAFO SEGUNDO: La cuota parte objeto de esta compraventa equivale al ${porcentaje} (correspondiente a una extensión superficiaria de ${lotArea} metros cuadrados). No obstante, la cabida extensión y alindamiento de que habla la cláusula primera de este contrato, la venta se hará como cuerpo cierto y comprenderá todos los derechos, anexidades, dependencias, reformas, adiciones, desenglobes y modificaciones del inmueble objeto del presente contrato. PARAGRAFO TERCERO: El promitente comprador manifiesta conocer las reglamentaciones de urbanismo y del medio ambiente, y todas las demás que le sean aplicables y que hayan sido expedidas por las autoridades correspondientes para el inmueble objeto de esta promesa. Así mismo declara conocer el estado material actual del inmueble el cual es usado, sus áreas y linderos específicos y servidumbres no inscritas, y en tal virtud manifiesta que conoce y acepta la reglamentación vigente en materia de servicios públicos y su disponibilidad, a la cual está sometido el inmueble objeto de la presente promesa de compraventa, así como los usos previstos en los correspondientes reglamentos y normas de urbanismo, en un todo de acuerdo con las previsiones legales y reglamentarias que sean aplicables y renuncia a cualquier proceso de reclamación o indemnización, judicial o extrajudicial ante el promitente vendedor por estos motivos.`
    );

    // SEGUNDA - TÍTULO
    addClause(
        'SEGUNDA. – TÍTULO:',
        `Por compraventa que le hiciera el señor DAVID SANTIAGO BONILLA FORERO, identificado con CC. 1.122.134.440 de acacias, mediante documento de compraventa otorgado el día 03 de junio de 2025, en la Notaría Cuarta del Círculo de Villavicencio. Y manifiesta que confiere al señor ${vendorName} identificado con C.C: ${vendorDoc} de ${ciudad.split('-')[0]?.trim() || 'Villavicencio'}, el título de propiedad para realizar los respectivos actos de compra y venta del suscrito predio.`
    );

    // TERCERA - POSESIÓN
    addClause(
        'TERCERA- POSESIÓN Y LIBERTAD:',
        `EL PROMITENTE VENDEDOR declara que posee real y materialmente el inmueble objeto de esta venta. También garantiza el promitente vendedor que posee el inmueble en forma regular, pacífica y pública y que el mismo se halla libre de servidumbres, usufructo, uso, arrendamiento por escritura pública, movilización, patrimonio de familia, afectación a vivienda familiar y en general.`
    );

    // CUARTA - PRECIO
    let paymentTypeText = `La totalidad del precio será cancelada de contado por el PROMITENTE COMPRADOR por un valor de ${priceInWords(salePrice)}.`;

    if (sale.paymentType !== 'cash' && sale.payment_type !== 'cash') {
        const separeAmount = parseFloat(cp.separeAmount || 0);
        
        let initialText = '';
        if (separeAmount > 0) {
            const separeDate = cp.separeDate || saleDate;
            const remainingInitial = downPayment - separeAmount;
            
            initialText = `A. Para el día de hoy ${formatDateSimple(separeDate)}, realiza el separe con la suma de ${priceInWords(separeAmount)}.`;
            if (remainingInitial > 0) {
                initialText += ` Posteriormente, el de ${formatDateSimple(saleDate)}, efectuó el pago correspondiente a la cuota inicial por un valor de ${priceInWords(remainingInitial)}.`;
            }
        } else {
            initialText = `A. Para la fecha de la venta, ${formatDateSimple(saleDate)}, realiza el pago de la cuota inicial por un valor de ${priceInWords(downPayment)}.`;
        }

        paymentTypeText = `${initialText}\n\nB. ${priceInWords(financedAmount)} serán pagados en (${numInstallments}) cuotas mensuales de ${priceInWords(Math.round(monthlyPayment))} que serán canceladas a partir del ${calculateStartDate(saleDate)} hasta el ${calculateEndDate(saleDate, numInstallments)}.`;
    }

    addClause(
        'CUARTA: PRECIO-',
        `El precio de la cuota parte es la suma de ${priceInWords(salePrice)} moneda corriente, suma que EL PROMITENTE COMPRADOR entrega al PROMITENTE VENDEDOR de la siguiente manera:\n\n${paymentTypeText}\n\nAsí mismo, las partes declaran las partes otorgantes que conocen el texto y alcance del artículo 61 de la ley 2010 del 27 de diciembre de 2019, por lo que BAJO LA GRAVEDAD DEL JURAMENTO que se entiende prestado por el solo hecho de la firma, expresan QUE EL PRECIO incluido en este documento es REAL y que no ha sido objeto de pactos privados en los que se señale en valor diferente y que no existen sumas que hayan facturado o convenido en ellos o de lo contrario deberá manifestar su valor. Sin las referidas declaraciones, tanto el impuesto sobre la renta como la ganancia ocasional, el impuesto de registro, los derechos de registro y los derechos notariales, serán liquidados sobre una base equivalente a cuatro (4) veces el valor incluido en la escritura en la escritura, sin perjuicio de la obligación del notario reportar la irregularidad a las autoridades de impuestos para lo de su competencia y sin detrimento de las facultades de la Dirección de Impuestos y Aduanas Nacionales – DIAN, para determinar el valor real de la transacción. PARÁGRAFO. CLAUSULA PENAL: Las partes de común acuerdo pactan como clausula penal a cargo de la parte que incumpla este negocio la suma de ${priceInWords(penaltyAmount)}, equivalente al ${penaltyPercent}% por ciento del valor total de esta negociación, valor que deberá cancelar la parte que incumpliere cualquiera de la cláusula de este contrato.`
    );

    // QUINTA - PLAZO
    addClause(
        'QUINTA. – PLAZO:',
        `LA ESCRITURA PÚBLICA QUE CONTENDRÁ EL CONTRATO DE COMPRAVENTA DE CUOTA PARTE, LE SERÁ OTORGADA EN LA ${notaria.toUpperCase()}, EL ${escrituraFecha ? formatDateSimple(escrituraFecha).toUpperCase() : '_______________'}, PARA EFECTOS CONTRACTUALES SE FIJA LA HORA ${escrituraHora}.`
    );

    // SEXTA - GASTOS
    addClause(
        'SEXTA. GASTOS ADMINISTRATIVOS, IMPUESTOS Y CONTRIBUCIONES.',
        `Se conviene expresamente que los impuestos incluido el de valorización y las contribuciones que se lleguen a causar, liquidar o reajustar con posterioridad a la fecha de escrituración del inmueble, estarán a cargo exclusivo de EL PROMITENTE COMPRADOR, cualquier otro gasto administrativo que se derive de la administración del inmueble como servicios públicos, administraciones, vigilancias, entre otros, será asumido por EL PROMITENTE COMPRADOR a partir de la fecha en que se suscriba el acta de entrega material del inmueble.`
    );

    // SÉPTIMA - PRÓRROGA
    addClause(
        'SÉPTIMA. - PRÓRROGA:',
        `El plazo para la celebración del contrato prometido podrá prorrogarse, de común acuerdo por las partes, el cual deberá constar por escrito.`
    );

    // OCTAVA - ENTREGA
    addClause(
        'OCTAVA. – ENTREGA:',
        `En la fecha de otorgamiento del presente documento el Promitente Vendedor se obliga frente al Promitente Comprador a: (i) Entregar el Inmueble al Promitente Comprador libre de embargos, pleitos pendientes, demandas civiles, gravámenes, censos, anticresis, contratos de arrendamiento por escritura pública, desmembraciones, condiciones resolutorias y patrimonio de familia, (ii) en paz y a salvo por concepto de servicios públicos del inmueble y en paz y salvo por todo concepto de impuestos, tasas, contribuciones de todo orden, y (iii) salir al saneamiento de la venta del Inmueble en los casos de ley y especialmente a responder por cualquier gravamen o acción real que resulte en contra del derecho de dominio que transferiría al Promitente Comprador, así como a responder por los perjuicios que tales acciones llegaren a causar al Promitente Comprador. PARAGRAFO. - La cuota parte de terreno objeto de este contrato de compraventa se entrega con servidumbre internas de uso de vías de vías áreas privadas de uso común, y redes de energía eléctrica las que son de uso privado, (los gastos que genere la matrícula e instalación del servicio de energía eléctrica en la cuota parte de terreno son cancelados en su totalidad por el COMPRADOR y no se encuentran fijados dentro del valor de la venta total de esta promesa). Adicional a la entrada de cada cuota parte se hará entrega de un punto de agua, de la cual el COMPRADOR no incurrirá en gastos adicionales por la instalación del mismo.`
    );

    // NOVENA - GASTOS NOTARIALES
    addClause(
        'NOVENA. – GASTOS NOTARIALES Y DE REGISTRO:',
        `Los gastos notariales que se ocasionen con el otorgamiento de la Escritura Pública de compraventa serán sufragados por partes iguales entre el PROMITENTE COMPRADOR y el PROMITENTE VENDEDOR. Los gastos que demande la boleta fiscal y su registro, incluyendo el impuesto de registro, será por cuenta del PROMITENTE COMPRADOR. Los gastos de retención en la fuente serán asumidos por el PROMITENTE VENDEDOR.`
    );

    // DÉCIMA - MÉRITO EJECUTIVO
    addClause(
        'DÉCIMA. – MÉRITO EJECUTIVO:',
        `Las partes declaran que este documento presta mérito ejecutivo para la efectividad de las obligaciones en él contenidas.`
    );

    // DÉCIMA PRIMERA - ORIGEN DE FONDOS
    addClause(
        'DÉCIMA PRIMERA. - DECLARACIÓN DE ORIGEN DE FONDOS:',
        `Las partes aquí intervinientes manifiestan que el origen de los dineros que aquí realizan y demás operaciones proceden del giro ordinario de actividades lícitas. Certifican y garantizan expresamente que los recursos o dineros provienen de buena fuente y por lo tanto no provienen de ninguna actividad ilícita de las contempladas en el Código Penal Colombiano o en cualquier norma que los adicione o modifique y en todo caso exoneran de responsabilidad al otro contratante, frente a esta cláusula.`
    );

    // DÉCIMA SEGUNDA - CESIÓN
    addClause(
        'DÉCIMA SEGUNDA. – CESIÓN:',
        `Las partes se comprometen a no ceder ni parcial, ni totalmente las obligaciones contenidas en el presente contrato, sin autorización previa y por escrito del contratante cedido. Si contravinieren esta disposición, la cesión no tendrá efectos jurídicos y por tanto no exime de responsabilidad a quien la haya realizado sin autorización de la otra parte.`
    );

    // ============ CLOSING & SIGNATURES ============
    y += 4;
    addWrappedText(
        `Para constancia el presente contrato se firma en la ciudad de ${ciudad.split('-')[0]?.trim() || 'Villavicencio'}, al ${formatDateLongSpanish(saleDate)}, en dos (2) ejemplares del mismo valor, cada uno de ellos con destino a cada una de las partes.`,
        marginLeft, contentWidth, 9, 'normal', 5
    );

    y += 20;
    if (y > pageHeight - 50) {
        doc.addPage();
        y = 40;
    }

    // Signatures
    doc.setDrawColor(80, 80, 80);
    const sigWidth = 70;

    // Vendor signature
    doc.line(marginLeft, y, marginLeft + sigWidth, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(vendorName, marginLeft, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`C.C. ${vendorDoc}`, marginLeft, y);
    y += 4;
    doc.text(`Celular: ${vendorPhone}`, marginLeft, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('EL PROMITENTE VENDEDOR', marginLeft, y);

    // Reset Y for buyer (same height)
    const buyerY = y - 16;
    doc.line(pageWidth - marginRight - sigWidth, buyerY, pageWidth - marginRight, buyerY);
    doc.setFont('helvetica', 'bold');
    doc.text(clientName, pageWidth - marginRight - sigWidth, buyerY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(`C.C: ${clientDoc}`, pageWidth - marginRight - sigWidth, buyerY + 8);
    doc.text(`Celular: ${clientPhone}`, pageWidth - marginRight - sigWidth, buyerY + 12);
    doc.setFont('helvetica', 'bold');
    doc.text('EL PROMITENTE COMPRADOR', pageWidth - marginRight - sigWidth, buyerY + 16);

    // ============ PAGE 2: ANEXO 1 ============
    doc.addPage();
    y = 25;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('ANEXO 1', pageWidth / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(10);
    doc.text('SEPARACIÓN CUOTA PARTE', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(9);
    doc.text(matricula, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(`${ciudad.split('-')[0]?.trim() || 'VILLAVICENCIO'} – ${ciudad.split('-')[1]?.trim() || 'META'}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(`PROMESA N°${promNum}`, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Vendor info
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(vendorName, marginLeft, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
    doc.text(`C.C. ${vendorDoc}`, marginLeft, y);
    y += 4;
    doc.text(`Celular: ${vendorPhone}`, marginLeft, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('EL PROMITENTE VENDEDOR', marginLeft, y);
    y += 8;

    // Buyer info
    doc.setFont('helvetica', 'bold');
    doc.text(clientName, marginLeft, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
    doc.text(`C.C: ${clientDoc}`, marginLeft, y);
    y += 4;
    doc.text(`Celular: ${clientPhone}`, marginLeft, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('EL PROMITENTE COMPRADOR', marginLeft, y);
    y += 10;

    // Annexe body
    addWrappedText(
        `Las partes antes referenciadas manifestaron que han CELEBRADO un CONTRATO DE PROMESA DE COMPRAVENTA DE CUOTA PARTE, sobre el bien inmueble allí descrito, equivalente al ${porcentaje} que hace referencia a una extensión superficiaria de ${lotArea} metros cuadrados, allí se prometió en venta del LOTE No.${lotNumber} como consta en el plano topográfico del proyecto "${projectName}".`,
        marginLeft, contentWidth, 9, 'normal', 5
    );

    // Annexe signatures
    y += 30;
    if (y > pageHeight - 60) y = pageHeight - 60;

    // Vendor
    doc.line(marginLeft, y, marginLeft + sigWidth, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(vendorName, marginLeft, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`C.C. ${vendorDoc}`, marginLeft, y);
    y += 4;
    doc.text(`Celular: ${vendorPhone}`, marginLeft, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('EL PROMITENTE VENDEDOR', marginLeft, y);

    // Buyer
    const buyerAnnexY = y - 16;
    doc.line(pageWidth - marginRight - sigWidth, buyerAnnexY, pageWidth - marginRight, buyerAnnexY);
    doc.setFont('helvetica', 'bold');
    doc.text(clientName, pageWidth - marginRight - sigWidth, buyerAnnexY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(`C.C: ${clientDoc}`, pageWidth - marginRight - sigWidth, buyerAnnexY + 8);
    doc.text(`Celular: ${clientPhone}`, pageWidth - marginRight - sigWidth, buyerAnnexY + 12);
    doc.setFont('helvetica', 'bold');
    doc.text('EL PROMITENTE COMPRADOR', pageWidth - marginRight - sigWidth, buyerAnnexY + 16);

    // ============ DOWNLOAD ============
    const filename = `Contrato_N${promNum}_Lote${lotNumber}_${clientName.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
    return filename;
}
