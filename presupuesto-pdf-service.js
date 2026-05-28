(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PresupuestoPdfService = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MM_TO_PT = 72 / 25.4;
  const DARK_GRAY = [66, 66, 66];
  const MID_GRAY = [140, 140, 140];
  const WHITE = [255, 255, 255];

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

  const ISSUER = Object.freeze({
    displayName: 'FLOPITEC SERVICIOS INFORMÁTICOS',
    address: 'C/ Pablo Iglesias 30 Bajo, 18140, La Zubia, Granada',
    owner: 'Luis Alemán Caballero',
    nif: '24255871W',
    phone: '958 891 822 / 609 917 893',
    whatsapp: '642 663 026',
  });

  function buildFileName(code) {
    return `${String(code || 'PR-SIN-CODIGO')}.pdf`;
  }

  function renderPdfToJsPdf(data, jsPDF) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margins = { top: mm(18), right: mm(22), bottom: mm(16), left: mm(22) };
    const contentW = pageW - margins.left - margins.right;
    const maxY = pageH - margins.bottom;

    const topBarH = mm(18);
    const tableHeaderH = mm(10);
    const legalBottomGap = mm(2.5);
    const legalYStart = maxY - mm(23.5);
    const contentBottomLimit = legalYStart - mm(6);

    let y = margins.top;

    const setFill = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    const setText = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

    const drawTopBar = () => {
      setFill(DARK_GRAY);
      doc.rect(margins.left, y, contentW, topBarH, 'F');

      const leftPad = mm(7);
      const rightPad = mm(7);
      const rightX = margins.left + contentW - rightPad;

      setText(WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('PRESUPUESTO', margins.left + leftPad, y + mm(11.6));

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.3);
      doc.text(`Fecha: ${fmtDate(data.presupuesto_date)}`, rightX, y + mm(6.5), { align: 'right' });
      doc.text(`Válido hasta: ${fmtDate(data.valid_until)}`, rightX, y + mm(10.8), { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(`Nº ${data.presupuesto_code || '—'}`, rightX, y + mm(15.2), { align: 'right' });

      setText([0, 0, 0]);
      y += topBarH + mm(9);
    };

    const drawIssuerCustomerBlock = () => {
      const gap = mm(10);
      const leftW = (contentW - gap) * 0.5;
      const rightW = contentW - gap - leftW;
      const leftX = margins.left;
      const rightX = leftX + leftW + gap;
      const startY = y;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Empresa emisora', leftX, y);
      doc.text('Cliente', rightX, y);
      y += mm(4.2);

      setText(MID_GRAY);
      doc.setLineWidth(0.45);
      doc.line(margins.left, y, margins.left + contentW, y);
      setText([0, 0, 0]);
      y += mm(4.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);

      const leftLines = [
        ISSUER.displayName,
        ISSUER.address,
        ISSUER.owner,
        `NIF/CIF: ${ISSUER.nif}`,
        `Tel: ${ISSUER.phone}`,
        `WhatsApp: ${ISSUER.whatsapp}`,
      ].filter(Boolean);

      const customerLines = [
        String(data.customer_name || '—').trim() || '—',
        data.customer_phone ? `Tel: ${data.customer_phone}` : '',
        data.customer_address ? `Dirección: ${data.customer_address}` : '',
        data.customer_city_line ? `Localidad: ${data.customer_city_line}` : '',
        data.customer_email ? `Email: ${data.customer_email}` : '',
      ].filter(Boolean);

      let leftCursorY = y;
      for (const line of leftLines) {
        const wrapped = doc.splitTextToSize(line, leftW);
        doc.text(wrapped, leftX, leftCursorY);
        leftCursorY += wrapped.length * mm(4.1);
      }

      let rightCursorY = y;
      for (const line of customerLines) {
        const wrapped = doc.splitTextToSize(line, rightW);
        doc.text(wrapped, rightX, rightCursorY);
        rightCursorY += wrapped.length * mm(4.1);
      }

      y = Math.max(leftCursorY, rightCursorY) + mm(5.5);
    };

    const drawTableHeader = () => {
      setFill(DARK_GRAY);
      doc.rect(margins.left, y, contentW, tableHeaderH, 'F');
      setText(WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.2);

      const x = margins.left;
      const descW = contentW * 0.56;
      const qtyW = contentW * 0.14;
      const unitW = contentW * 0.15;
      const totalW = contentW - descW - qtyW - unitW;

      const textY = y + tableHeaderH / 2 + 3;
      doc.text('Descripción / Concepto', x + mm(2.3), textY, { baseline: 'middle' });
      doc.text('Cant.', x + descW + qtyW / 2, textY, { align: 'center', baseline: 'middle' });
      doc.text('P.Unit.', x + descW + qtyW + unitW / 2, textY, { align: 'center', baseline: 'middle' });
      doc.text('Total', x + contentW - mm(2.3), textY, { align: 'right', baseline: 'middle' });

      setText([0, 0, 0]);
      y += tableHeaderH;
      return { x, descW, qtyW, unitW, totalW };
    };

    const ensureSpace = (needed, includeHeader) => {
      if (y + needed <= contentBottomLimit) return;
      doc.addPage();
      y = margins.top;
      drawTopBar();
      if (includeHeader) cols = drawTableHeader();
    };

    const drawLegalFixedBottom = () => {
      let legalY = legalYStart;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      for (const line of LEGAL_LINES) {
        const wrapped = doc.splitTextToSize(line, contentW);
        doc.text(wrapped, margins.left, legalY);
        legalY += wrapped.length * mm(3.6);
      }
      // línea visual suave sobre bloque legal
      setText(MID_GRAY);
      doc.setLineWidth(0.35);
      doc.line(margins.left, legalYStart - mm(2.7), margins.left + contentW, legalYStart - mm(2.7));
      setText([0, 0, 0]);
      return legalY + legalBottomGap;
    };

    drawTopBar();
    drawIssuerCustomerBlock();
    let cols = drawTableHeader();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.3);

    (data.items || []).forEach((it, idx) => {
      const concept = String(it?.concept || '—');
      const qty = String(it?.quantity ?? 0).replace('.', ',');
      const unit = fmtMoney(it?.unit_price);
      const lineTotalValue = Number.isFinite(Number(it?.line_total)) ? it.line_total : toMoney(Number(it?.quantity || 0) * Number(it?.unit_price || 0));
      const total = fmtMoney(lineTotalValue);

      const descLines = doc.splitTextToSize(concept, cols.descW - mm(4.8));
      const lineCount = Math.max(1, descLines.length);
      const rowH = Math.max(mm(8.2), lineCount * mm(4.2) + mm(3.2));

      ensureSpace(rowH + mm(0.5), true);

      const rowTop = y;
      setText(MID_GRAY);
      doc.setLineWidth(0.2);
      doc.line(cols.x, rowTop, cols.x + contentW, rowTop);
      setText([0, 0, 0]);

      doc.text(descLines, cols.x + mm(2.4), rowTop + mm(4.8));
      doc.text(qty, cols.x + cols.descW + cols.qtyW / 2, rowTop + rowH / 2 + 2.7, { align: 'center', baseline: 'middle' });
      doc.text(unit, cols.x + cols.descW + cols.qtyW + cols.unitW / 2, rowTop + rowH / 2 + 2.7, { align: 'center', baseline: 'middle' });
      doc.text(total, cols.x + contentW - mm(2.4), rowTop + rowH / 2 + 2.7, { align: 'right', baseline: 'middle' });

      y += rowH;
      if (idx === (data.items || []).length - 1) {
        setText(MID_GRAY);
        doc.line(cols.x, y, cols.x + contentW, y);
        setText([0, 0, 0]);
      }
    });

    ensureSpace(mm(18), false);
    y += mm(4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(`TOTAL PRESUPUESTO: ${fmtMoney(data.total_amount)}`, margins.left + contentW, y, { align: 'right' });

    if (data.comments) {
      const commentTitleGap = mm(8.2);
      const commentBodyGap = mm(4.8);
      const commentsLines = doc.splitTextToSize(String(data.comments), contentW);
      const commentsHeight = commentsLines.length * mm(3.9) + mm(10);
      ensureSpace(commentTitleGap + commentsHeight, false);

      y += commentTitleGap;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Comentarios', margins.left, y);
      y += commentBodyGap;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.3);
      doc.text(commentsLines, margins.left, y);
      y += commentsLines.length * mm(3.9);
    }

    if (y > contentBottomLimit - mm(1)) {
      doc.addPage();
      y = margins.top;
      drawTopBar();
    }

    drawLegalFixedBottom();
    return doc;
  }

  return { buildFileName, renderPdfToJsPdf };
});
