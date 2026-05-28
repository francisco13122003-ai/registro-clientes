(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PresupuestoPdfService = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MM_TO_PT = 72 / 25.4;
  const mm = (v) => v * MM_TO_PT;
  const toMoney = (v) => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  };
  const fmtMoney = (v) => `${toMoney(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const fmtDate = (v) => (v ? String(v).split('-').reverse().join('/') : '—');

  const LEGAL_LINES = [
    'Este documento es un presupuesto informativo y no constituye ticket ni factura.',
    'La elaboración del presupuesto puede tener coste cuando haya sido previamente informado y aceptado por el cliente.',
    'Validez temporal: este presupuesto es válido hasta la fecha indicada en el propio documento.',
    'Tras la fecha de validez, precios y disponibilidad de material/servicios pueden variar.',
  ];

  function buildFileName(code) {
    return `${String(code || 'PR-SIN-CODIGO')}.pdf`;
  }

  function renderPdfToJsPdf(data, jsPDF) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margins = { top: mm(18), right: mm(20), bottom: mm(18), left: mm(20) };
    const cw = pageW - margins.left - margins.right;
    let y = margins.top;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('PRESUPUESTO', margins.left, y);
    doc.setFontSize(10);
    doc.text(`Nº ${data.presupuesto_code || '—'}`, margins.left + cw, y, { align: 'right' });
    y += mm(8);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`Fecha: ${fmtDate(data.presupuesto_date)}`, margins.left, y);
    doc.text(`Válido hasta: ${fmtDate(data.valid_until)}`, margins.left + cw, y, { align: 'right' });
    y += mm(8);
    doc.text(`Cliente: ${data.customer_name || '—'}`, margins.left, y);
    y += mm(5);
    if (data.customer_phone) { doc.text(`Teléfono: ${data.customer_phone}`, margins.left, y); y += mm(5); }
    if (data.customer_address) { doc.text(`Dirección: ${data.customer_address}`, margins.left, y); y += mm(7); }

    doc.setFont('helvetica', 'bold');
    doc.text('Concepto', margins.left, y);
    doc.text('Cant.', margins.left + cw * 0.58, y, { align: 'center' });
    doc.text('P.Unit.', margins.left + cw * 0.74, y, { align: 'center' });
    doc.text('Total', margins.left + cw, y, { align: 'right' });
    y += mm(2);
    doc.line(margins.left, y, margins.left + cw, y);
    y += mm(5);

    doc.setFont('helvetica', 'normal');
    (data.items || []).forEach((it) => {
      doc.text(String(it.concept || '—'), margins.left, y, { maxWidth: cw * 0.55 });
      doc.text(String(it.quantity ?? 0).replace('.', ','), margins.left + cw * 0.58, y, { align: 'center' });
      doc.text(fmtMoney(it.unit_price), margins.left + cw * 0.74, y, { align: 'center' });
      doc.text(fmtMoney(it.line_total), margins.left + cw, y, { align: 'right' });
      y += mm(6);
    });

    y += mm(3);
    doc.line(margins.left + cw * 0.6, y, margins.left + cw, y);
    y += mm(6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(`TOTAL PRESUPUESTO: ${fmtMoney(data.total_amount)}`, margins.left + cw, y, { align: 'right' });
    y += mm(10);

    if (data.comments) {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text('Comentarios', margins.left, y); y += mm(5);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(String(data.comments), cw);
      doc.text(lines, margins.left, y);
      y += lines.length * mm(4.2) + mm(3);
    }

    doc.setFontSize(8.8);
    LEGAL_LINES.forEach((line) => {
      const lines = doc.splitTextToSize(line, cw);
      doc.text(lines, margins.left, y);
      y += lines.length * mm(3.8);
    });

    return doc;
  }

  return { buildFileName, renderPdfToJsPdf };
});
