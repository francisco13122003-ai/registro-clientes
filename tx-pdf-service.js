(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TxPdfService = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MM_TO_PT = 72 / 25.4;
  const DARK_GRAY = [66, 66, 66];
  const MID_GRAY = [140, 140, 140];
  const WHITE = [255, 255, 255];

  const FLOPITEC_LEGAL = Object.freeze({
    displayName: 'FLOPITEC SERVICIOS INFORMÁTICOS',
    razonSocial: 'Luis Alemán Caballero',
    nif: '24255871W',
    direccion: 'C/ Pablo Iglesias 30 Bajo, 18140, La Zubia, Granada',
    actividad: '',
    telefono: '',
    email: '',
    bankInfoLines: [],
  });

  function mm(value) {
    return value * MM_TO_PT;
  }

  function toMoney(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }

  function formatMoneyEs(value) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }

  function formatDateShort(value) {
    if (!value) return '—';
    const raw = String(value).trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1].slice(-2)}`;
    const direct = raw.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
    if (direct) {
      const yy = direct[3].slice(-2);
      return `${direct[1]}/${direct[2]}/${yy}`;
    }
    return raw;
  }

  function buildTxPdfFileName({ txCode }) {
    const rawCode = String(txCode || '').trim();
    const safeCode = rawCode.replace(/[^A-Za-z0-9\-_.]+/g, '_') || 'SIN-CODIGO';
    return `${safeCode}.pdf`;
  }

  function buildRecipientBlock(customer, company) {
    const isCompany = !!customer?.is_company;
    if (isCompany) {
      return {
        title: 'Factura',
        name: company?.business_name || 'Empresa',
        nif: company?.cif || '',
        address: [company?.address, company?.postal_code, company?.city, company?.province]
          .filter(Boolean)
          .join(', '),
        cityLine: [company?.postal_code, company?.city].filter(Boolean).join(' '),
      };
    }

    return {
      title: 'Documento de venta',
      name: `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Cliente',
      nif: '',
      address: customer?.address || '',
      cityLine: '',
    };
  }

  function normalizeConceptLines(tx, items) {
    const normalizedItems = (items || [])
      .map((it) => {
        const concept = String(it?.concept || '').trim();
        const quantityRaw = Number(it?.quantity ?? 1);
        const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
        const lineTotal = toMoney(it?.amount);
        const unitPrice = quantity > 0 ? toMoney(lineTotal / quantity) : lineTotal;

        return {
          concept,
          quantity,
          unitPrice,
          lineTotal,
        };
      })
      .filter((it) => it.concept || it.lineTotal);

    if (normalizedItems.length) return normalizedItems;

    return [
      {
        concept: String(tx?.comments || 'Registro de venta/reparación').trim(),
        quantity: 1,
        unitPrice: toMoney(tx?.total_amount),
        lineTotal: toMoney(tx?.total_amount),
      },
    ];
  }

  function buildPdfData({ tx, items, customer, company, txCode }) {
    const recipient = buildRecipientBlock(customer, company);
    const concepts = normalizeConceptLines(tx, items);

    // Regla de negocio (2026-03): cada concepto ya viene con IVA incluido.
    // Por tanto, el total fiscal del documento es exactamente la suma introducida en el registro.
    const totalConIva = toMoney(concepts.reduce((sum, line) => sum + toMoney(line.lineTotal), 0));

    // Desglose inverso de IVA al 21% SIN volver a incrementar importes:
    // base = total / 1.21
    // iva = total - base
    const ivaPorcentaje = 21;
    const baseImponible = toMoney(totalConIva / 1.21);
    const ivaImporte = toMoney(totalConIva - baseImponible);
    const subtotal = baseImponible;
    const total = totalConIva;

    return {
      docTitle: recipient.title,
      recipient,
      txDate: tx?.tx_date || '',
      txCode: txCode || '',
      concepts,
      subtotal,
      baseImponible,
      ivaPorcentaje,
      ivaImporte,
      total,
      companyIssuer: FLOPITEC_LEGAL,
      bankInfoLines: FLOPITEC_LEGAL.bankInfoLines || [],
    };
  }

  function renderPdfToJsPdf(data, jspdfCtor) {
    const doc = new jspdfCtor({ unit: 'pt', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margins = {
      top: mm(18),
      right: mm(22),
      bottom: mm(20),
      left: mm(22),
    };

    const contentWidth = pageWidth - margins.left - margins.right;
    const maxY = pageHeight - margins.bottom;

    const tableHeaderHeight = mm(11);
    const topBarHeight = mm(18);

    let y = margins.top;

    const setFill = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    const setText = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

    const drawTopBar = () => {
      setFill(DARK_GRAY);
      doc.rect(margins.left, y, contentWidth, topBarHeight, 'F');

      const leftPadding = mm(7);
      const rightPadding = mm(7);
      const centerY = y + topBarHeight / 2;
      const title = String(data.docTitle || 'FACTURA').toUpperCase();

      setText(WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(title, margins.left + leftPadding, centerY + 5, { baseline: 'middle' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const rightX = margins.left + contentWidth - rightPadding;
      doc.text(`Fecha: ${formatDateShort(data.txDate)}`, rightX, y + mm(6.8), { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(`Nº ${data.txCode || '—'}`, rightX, y + mm(13.1), { align: 'right' });

      setText([0, 0, 0]);
      y += topBarHeight + mm(10);
    };

    const newPage = (withTableHeader) => {
      doc.addPage();
      y = margins.top;
      if (withTableHeader) drawTableHeader();
    };

    const ensureSpace = (needed, withTableHeaderOnBreak) => {
      if (y + needed <= maxY) return;
      newPage(withTableHeaderOnBreak);
    };

    const issuerCustomerBlock = () => {
      const gap = mm(12);
      const issuerWidth = (contentWidth - gap) * 0.52;
      const customerWidth = contentWidth - gap - issuerWidth;
      const issuerX = margins.left;
      const customerX = issuerX + issuerWidth + gap;
      const startY = y;

      const lineGap = mm(4.7);
      const lineHeight = mm(4.2);

      // Emisor
      let issuerY = startY;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(data.companyIssuer.displayName || 'FLOPITEC', issuerX, issuerY);
      issuerY += lineGap;

      setText(MID_GRAY);
      doc.setLineWidth(0.5);
      doc.line(issuerX, issuerY, issuerX + issuerWidth, issuerY);
      setText([0, 0, 0]);
      issuerY += mm(4.2);

      const issuerLines = [
        data.companyIssuer.direccion,
        data.companyIssuer.razonSocial,
        [
          data.companyIssuer.nif ? `NIF/CIF: ${data.companyIssuer.nif}` : '',
          data.companyIssuer.actividad ? `Actividad: ${data.companyIssuer.actividad}` : '',
        ].filter(Boolean).join(' · '),
        data.companyIssuer.telefono ? `Teléfono: ${data.companyIssuer.telefono}` : '',
        data.companyIssuer.email ? `Email: ${data.companyIssuer.email}` : '',
      ].filter(Boolean);

      issuerLines.forEach((line, index) => {
        if (index === 1) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
        }
        const wrapped = doc.splitTextToSize(line, issuerWidth - mm(1));
        doc.text(wrapped, issuerX, issuerY);
        issuerY += wrapped.length * lineHeight;
      });

      // Cliente
      let customerY = startY;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('CLIENTE', customerX, customerY);
      customerY += lineGap;

      setText(MID_GRAY);
      doc.line(customerX, customerY, customerX + customerWidth, customerY);
      setText([0, 0, 0]);
      customerY += mm(4.2);

      const customerFields = [
        ['NOMBRE:', data.recipient.name || ''],
        ['DIRECCION:', data.recipient.address || ''],
        ['CP/CIUDAD:', data.recipient.cityLine || ''],
        ['CIF/NIF:', data.recipient.nif || ''],
      ];

      customerFields.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(label, customerX, customerY);
        doc.setFont('helvetica', 'normal');

        const labelWidth = mm(22);
        const wrapped = value
          ? doc.splitTextToSize(value, customerWidth - labelWidth)
          : [''];

        doc.text(wrapped, customerX + labelWidth, customerY);
        customerY += Math.max(1, wrapped.length) * lineHeight;
      });

      y = Math.max(issuerY, customerY) + mm(12);
    };

    const tableColumns = [
      { label: 'DESCRIPCIÓN', width: 0.6, align: 'left' },
      { label: 'PRECIO UD', width: 0.13, align: 'right' },
      { label: 'CANTIDAD', width: 0.11, align: 'center' },
      { label: 'TOTAL', width: 0.16, align: 'right' },
    ];

    const drawTableHeader = () => {
      ensureSpace(tableHeaderHeight + mm(5), false);
      setFill(DARK_GRAY);
      doc.rect(margins.left, y, contentWidth, tableHeaderHeight, 'F');
      setText(WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);

      let x = margins.left;
      tableColumns.forEach((col) => {
        const colW = contentWidth * col.width;
        const textY = y + tableHeaderHeight / 2 + 3;
        const leftPad = mm(2.4);
        const rightPad = mm(2.4);

        if (col.align === 'left') {
          doc.text(col.label, x + leftPad, textY, { baseline: 'middle' });
        } else if (col.align === 'center') {
          doc.text(col.label, x + colW / 2, textY, { align: 'center', baseline: 'middle' });
        } else {
          doc.text(col.label, x + colW - rightPad, textY, { align: 'right', baseline: 'middle' });
        }
        x += colW;
      });

      setText([0, 0, 0]);
      y += tableHeaderHeight;
    };

    const drawConceptRows = () => {
      const lineHeight = mm(4.4);
      const verticalPadding = mm(1.9);
      const minRowHeight = mm(10);

      data.concepts.forEach((line) => {
        const descWidth = contentWidth * tableColumns[0].width - mm(4.8);
        const descLines = doc.splitTextToSize(line.concept || 'Concepto', descWidth);
        const rowHeight = Math.max(minRowHeight, descLines.length * lineHeight + verticalPadding * 2);

        ensureSpace(rowHeight, true);

        const rowTop = y;
        const rowBottom = rowTop + rowHeight;

        let x = margins.left;
        const descriptionColW = contentWidth * tableColumns[0].width;
        const unitColW = contentWidth * tableColumns[1].width;
        const qtyColW = contentWidth * tableColumns[2].width;
        const totalColW = contentWidth * tableColumns[3].width;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.text(descLines, x + mm(2.4), rowTop + verticalPadding + lineHeight - mm(0.5));
        x += descriptionColW;

        doc.text(formatMoneyEs(line.unitPrice), x + unitColW - mm(2.4), rowTop + rowHeight / 2 + 3, {
          align: 'right',
          baseline: 'middle',
        });
        x += unitColW;

        doc.text(String(line.quantity ?? 1).replace('.', ','), x + qtyColW / 2, rowTop + rowHeight / 2 + 3, {
          align: 'center',
          baseline: 'middle',
        });
        x += qtyColW;

        doc.text(formatMoneyEs(line.lineTotal), x + totalColW - mm(2.4), rowTop + rowHeight / 2 + 3, {
          align: 'right',
          baseline: 'middle',
        });

        setText(MID_GRAY);
        doc.setLineWidth(0.4);
        doc.line(margins.left, rowBottom, margins.left + contentWidth, rowBottom);
        setText([0, 0, 0]);

        y = rowBottom;
      });

      if (data.concepts.length <= 1) y += mm(16);
    };

    const drawSubtotal = () => {
      y += mm(9);
      const blockWidth = mm(64);
      const blockHeight = mm(10);
      ensureSpace(blockHeight + mm(6), false);

      const x = margins.left + contentWidth - blockWidth;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('SUBTOTAL', x + mm(3), y + blockHeight / 2 + 3, { baseline: 'middle' });
      doc.text(formatMoneyEs(data.subtotal), x + blockWidth - mm(3), y + blockHeight / 2 + 3, {
        align: 'right',
        baseline: 'middle',
      });

      setText(MID_GRAY);
      doc.setLineWidth(0.6);
      doc.line(x, y + blockHeight, x + blockWidth, y + blockHeight);
      setText([0, 0, 0]);

      y += blockHeight;
    };

    const drawIvaTotalBar = () => {
      y += mm(8);
      const barHeight = mm(16);
      ensureSpace(barHeight + mm(6), false);

      setFill(DARK_GRAY);
      doc.rect(margins.left, y, contentWidth, barHeight, 'F');

      const rightBlockX = margins.left + contentWidth * 0.54;
      const rightBlockW = contentWidth * 0.46;

      setText(WHITE);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(`IVA ${data.ivaPorcentaje}%`, rightBlockX + mm(3), y + mm(6.3));
      doc.text(formatMoneyEs(data.ivaImporte), rightBlockX + rightBlockW - mm(3), y + mm(6.3), { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.text('TOTAL FACTURA', rightBlockX + mm(3), y + mm(12.7));
      doc.setFontSize(13.5);
      doc.text(formatMoneyEs(data.total), rightBlockX + rightBlockW - mm(3), y + mm(12.9), { align: 'right' });

      setText([0, 0, 0]);
      y += barHeight;
    };

    const drawSignatureAndBank = () => {
      y += mm(10);

      const stampW = mm(62);
      const stampH = mm(40);
      const rowHeight = stampH + mm(8);
      const bankLines = Array.isArray(data.bankInfoLines) ? data.bankInfoLines.filter(Boolean) : [];
      const bankHeight = bankLines.length ? mm(8) + bankLines.length * mm(4.5) : 0;

      ensureSpace(rowHeight + bankHeight + mm(6), false);

      const leftWidth = mm(48);
      const rightWidth = mm(46);
      const availableCenter = contentWidth - leftWidth - rightWidth;
      const centerX = margins.left + leftWidth + Math.max(0, (availableCenter - stampW) / 2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.8);
      doc.text('CONFORME CLIENTE:', margins.left, y + mm(5));

      // Hueco en blanco para sello físico (intencionalmente vacío)
      doc.setDrawColor(220, 220, 220);
      doc.rect(centerX, y, stampW, stampH, 'S');
      doc.setDrawColor(0, 0, 0);

      const rightX = margins.left + contentWidth - rightWidth;
      doc.text('FIRMADO:', rightX, y + mm(5));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(data.companyIssuer.razonSocial || '', rightX, y + mm(11));

      y += rowHeight;

      if (bankLines.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.2);
        bankLines.forEach((line) => {
          doc.text(line, margins.left, y);
          y += mm(4.5);
        });
      }
    };

    drawTopBar();
    issuerCustomerBlock();
    drawTableHeader();
    drawConceptRows();
    drawSubtotal();
    drawIvaTotalBar();
    drawSignatureAndBank();

    return doc;
  }

  return {
    FLOPITEC_LEGAL,
    toMoney,
    buildTxPdfFileName,
    buildPdfData,
    renderPdfToJsPdf,
  };
});
