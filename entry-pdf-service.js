(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EntryPdfService = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MM_TO_PT = 72 / 25.4;
  const DARK_GRAY = [66, 66, 66];
  const MID_GRAY = [140, 140, 140];
  const WHITE = [255, 255, 255];

  const COMPANY = Object.freeze({
    displayName: 'FLOPITEC SERVICIOS INFORMATICOS',
    nif: '24255871W',
    phone: '958891822',
    address: 'C/Pablo Iglesias 30 bajo, La Zubia, Granada, 18140',
    email: 'flopitec@hotmail.com',
  });

  const LEGAL = [
    ['Custodia / depósito', 'El cliente será avisado cuando el aparato esté diagnosticado, reparado o disponible para su recogida. Transcurrido un mes desde dicha comunicación sin que el aparato sea retirado, podrán devengarse gastos de almacenamiento o custodia de 3,00 €/día, IVA incluido, siempre que dicha tarifa conste claramente expuesta al público y haya sido informada al cliente.'],
    ['Renuncia a presupuesto previo', 'El cliente declara que renuncia expresamente a recibir presupuesto previo por escrito antes del inicio de la revisión o reparación del aparato, autorizando al servicio técnico a realizar el diagnóstico y las actuaciones aceptadas. Si durante la intervención apareciesen averías o defectos ocultos que impliquen un coste adicional relevante, se informará al cliente para su aceptación cuando proceda.'],
    ['Mano de obra', 'La tarifa de mano de obra es de 35,00 €/hora, IVA incluido, salvo presupuesto, promoción o acuerdo específico distinto. Las piezas, desplazamientos, transportes u otros conceptos se informarán o presupuestarán aparte cuando proceda.'],
    ['Protección de datos', 'Información básica sobre protección de datos: Responsable: Flopitec Servicios Informaticos, NIF 24255871W, con domicilio en C/Pablo Iglesias 30 bajo, La Zubia, Granada, 18140, teléfono 958891822 y correo electrónico flopitec@hotmail.com. Finalidad: gestionar la recepción, depósito, diagnóstico, reparación, comunicación con el cliente, facturación y cumplimiento de obligaciones legales. Legitimación: ejecución de la relación contractual o precontractual, cumplimiento de obligaciones legales e interés legítimo en la gestión administrativa y defensa de reclamaciones. Destinatarios: no se cederán datos a terceros salvo obligación legal o proveedores necesarios para la prestación del servicio. Derechos: el cliente puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad mediante solicitud a flopitec@hotmail.com o en la dirección indicada. Conservación: los datos se conservarán durante el tiempo necesario para la prestación del servicio y durante los plazos exigidos por obligaciones legales, fiscales o de garantía.'],
    ['Datos del dispositivo', 'El cliente declara que los datos del aparato, accesorios entregados y daños visibles reflejados en este registro son correctos en el momento de la entrega. El servicio técnico no responderá por accesorios, tarjetas, fundas, cargadores u otros elementos no declarados en este documento.'],
    ['Copia de seguridad', 'El cliente declara haber sido informado de la conveniencia de realizar copia de seguridad de sus datos antes de la intervención. El servicio técnico no garantiza la conservación de la información almacenada en el dispositivo, salvo responsabilidad legalmente exigible.'],
  ];

  const mm = (v) => v * MM_TO_PT;
  const fmtDate = (v) => (v ? String(v).split('-').reverse().join('/') : '—');
  const safe = (v) => String(v || '—');
  function buildFileName(reCode) { return `${String(reCode || 'RE-SIN-CODIGO')}.pdf`; }

  function renderPdfToJsPdf(data, jsPDF) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margins = { top: mm(18), right: mm(22), bottom: mm(18), left: mm(22) };
    const contentWidth = pageWidth - margins.left - margins.right;
    let y = margins.top;

    const ensure = (need) => { if (y + need <= pageHeight - margins.bottom) return; doc.addPage(); y = margins.top; };

    doc.setFillColor(...DARK_GRAY);
    doc.rect(margins.left, y, contentWidth, mm(18), 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('REGISTRO DE ENTRADA', margins.left + mm(7), y + mm(12));
    doc.setFontSize(10);
    doc.text(`Nº ${safe(data.re_code)}`, margins.left + contentWidth - mm(7), y + mm(7), { align: 'right' });
    doc.text(`Fecha: ${fmtDate(data.reception_date)}`, margins.left + contentWidth - mm(7), y + mm(13), { align: 'right' });
    y += mm(28);

    doc.setTextColor(0,0,0);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Empresa', margins.left, y);
    doc.text('Cliente', margins.left + contentWidth * 0.52, y);
    y += mm(4);
    doc.setTextColor(...MID_GRAY); doc.line(margins.left, y, margins.left + contentWidth, y); doc.setTextColor(0,0,0); y += mm(5);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    const left = [COMPANY.displayName, `NIF: ${COMPANY.nif}`, `Tel: ${COMPANY.phone}`, COMPANY.address, COMPANY.email];
    const right = [safe(data.customer_name), data.customer_phone ? `Tel: ${data.customer_phone}` : '', safe(data.customer_address)].filter(Boolean);
    left.forEach((l,i)=> doc.text(l, margins.left, y + i*mm(4.6), { maxWidth: contentWidth*0.48 }));
    right.forEach((l,i)=> doc.text(l, margins.left + contentWidth*0.52, y + i*mm(4.6), { maxWidth: contentWidth*0.46 }));
    y += mm(26);

    const fields = [
      ['Concepto/aparato', data.device_title], ['Marca', data.brand], ['Modelo', data.model], ['Nº Serie', data.serial_number],
      ['Accesorios', data.accessories], ['Daños visibles / estado físico', data.visible_damage], ['Diagnóstico previo o descripción', data.preliminary_diagnosis], ['Plazo previsto', data.expected_delivery_date ? fmtDate(data.expected_delivery_date) : '—']
    ];
    const labelWidth = mm(56);
    const valueX = margins.left + labelWidth + mm(7);
    const valueWidth = contentWidth - labelWidth - mm(7);
    doc.setFontSize(9.4);
    fields.forEach(([k,v]) => {
      const labelLines = doc.splitTextToSize(`${k}:`, labelWidth);
      const valueLines = doc.splitTextToSize(String(v || '—'), valueWidth);
      const lineStep = mm(4.0);
      const rowHeight = Math.max(labelLines.length, valueLines.length) * lineStep + mm(1.8);
      ensure(rowHeight + mm(1.2));
      doc.setFont('helvetica','bold');
      doc.text(labelLines, margins.left, y);
      doc.setFont('helvetica','normal');
      doc.text(valueLines, valueX, y, { maxWidth: valueWidth });
      y += rowHeight;
    });

    const legalFontSize = 7.1;
    const legalLineStep = mm(2.85);
    const legalRows = LEGAL.map(([title, body]) => ({
      title,
      lines: doc.splitTextToSize(body, contentWidth - mm(23)),
    }));
    const legalHeight = legalRows.reduce((sum, row) => sum + Math.max(mm(3.6), row.lines.length * legalLineStep) + mm(0.8), 0);
    const signaturesHeight = mm(17);
    const bottomReserved = legalHeight + signaturesHeight + mm(2);
    const signaturesTop = Math.max(y + mm(10), pageHeight - margins.bottom - bottomReserved + mm(1));
    y = signaturesTop;

    doc.line(margins.left, y, margins.left + contentWidth * 0.42, y);
    doc.line(margins.left + contentWidth * 0.58, y, margins.left + contentWidth, y);
    y += mm(4);
    doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.text('Firma cliente', margins.left, y);
    doc.text('Flopitec Servicios Informaticos / autorizado', margins.left + contentWidth * 0.58, y);
    y += mm(6.5);

    doc.setFontSize(legalFontSize);
    LEGAL.forEach(([title], idx) => {
      const row = legalRows[idx];
      doc.setFont('helvetica','bold');
      doc.text(`${title}:`, margins.left, y);
      doc.setFont('helvetica','normal');
      doc.text(row.lines, margins.left + mm(21), y, { maxWidth: contentWidth - mm(23) });
      y += Math.max(mm(3.6), row.lines.length * legalLineStep) + mm(0.8);
    });

    return doc;
  }

  return { buildFileName, renderPdfToJsPdf };
});
