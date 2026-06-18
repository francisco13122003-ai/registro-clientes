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


  const SALES_LEGAL_NOTICE = Object.freeze({
    title: 'CONDICIONES Y GARANTÍAS',
    paragraphs: [
      'Conserve este documento para cualquier gestión de garantía, cambio o reclamación.',
      'Los productos nuevos cuentan con la garantía legal mínima vigente. Los productos reacondicionados o de segunda mano quedan cubiertos por la garantía legal aplicable, salvo pacto específico documentado.',
      'La garantía cubre faltas de conformidad del producto. No cubre daños por golpes, líquidos, mal uso, manipulación no autorizada, desgaste normal, instalación incorrecta ajena a la empresa, virus/software, pérdida de datos ni pérdida de accesorios.',
      'Las reparaciones, instalaciones o intervenciones técnicas realizadas por el establecimiento cuentan con una garantía mínima legal de 3 meses sobre la intervención efectuada.',
      'En compras presenciales, los cambios o devoluciones comerciales solo se admitirán cuando procedan según la política del establecimiento o por garantía legal. No se admitirán cambios de software, licencias activadas, consumibles abiertos, productos personalizados, bajo pedido o manipulados, salvo defecto cubierto por garantía legal.',
      'El cliente es responsable de realizar copia de seguridad de sus datos antes de cualquier instalación, reparación o manipulación del equipo, salvo contratación expresa de dicho servicio.',
      'Existen hojas de quejas y reclamaciones a disposición de las personas consumidoras.',
    ],
  });

  const FLOPITEC_LEGAL = Object.freeze({
    displayName: 'FLOPITEC SERVICIOS INFORMÁTICOS',
    razonSocial: 'Luis Alemán Caballero',
    nif: '24255871W',
    direccion: 'C/ Pablo Iglesias 30 Bajo, 18140, La Zubia, Granada',
    actividad: '',
    telefono: '958 891 822 / 609 917 893',
    whatsapp: '642 663 026',
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
        const hasStoredUnitPrice = it?.unit_price !== null && it?.unit_price !== undefined && it?.unit_price !== '';
        const storedUnitPrice = Number(it?.unit_price);
        const unitPrice = hasStoredUnitPrice && Number.isFinite(storedUnitPrice) ? toMoney(storedUnitPrice) : (quantity > 0 ? toMoney(lineTotal / quantity) : lineTotal);

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
    const txKind = String(tx?.kind || '').toLowerCase();
    const isInvoice = txKind === 'factura';
    const recipient = buildRecipientBlock(customer, company);
    if (!isInvoice) recipient.nif = '';
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
      isInvoice,
      totalLabel: isInvoice ? 'TOTAL FACTURA' : 'TOTAL',
      showIssuerTaxId: isInvoice,
      showRecipientTaxId: isInvoice,
      companyIssuer: FLOPITEC_LEGAL,
      bankInfoLines: FLOPITEC_LEGAL.bankInfoLines || [],
      salesLegalNotice: SALES_LEGAL_NOTICE,
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
          data.showIssuerTaxId && data.companyIssuer.nif ? `NIF/CIF: ${data.companyIssuer.nif}` : '',
          data.companyIssuer.actividad ? `Actividad: ${data.companyIssuer.actividad}` : '',
        ].filter(Boolean).join(' · '),
        data.companyIssuer.telefono ? `Tel: ${data.companyIssuer.telefono}` : '',
        data.companyIssuer.whatsapp ? `WhatsApp: ${data.companyIssuer.whatsapp}` : '',
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
      ];
      if (data.showRecipientTaxId) {
        customerFields.push(['CIF/NIF:', data.recipient.nif || '']);
      }

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

    const columnGap = mm(4);
    const tableColumns = {
      tableRight: margins.left + contentWidth - mm(2.4),
      descriptionX: margins.left + mm(2.4),
      priceWidth: mm(28),
      qtyWidth: mm(14),
      totalWidth: mm(34),
    };
    tableColumns.totalX = tableColumns.tableRight;
    tableColumns.totalLeft = tableColumns.totalX - tableColumns.totalWidth;
    tableColumns.qtyCenterX = tableColumns.totalLeft - columnGap - tableColumns.qtyWidth / 2;
    tableColumns.qtyX = tableColumns.qtyCenterX - tableColumns.qtyWidth / 2;
    tableColumns.priceX = tableColumns.qtyX - columnGap - tableColumns.priceWidth;
    tableColumns.priceRightX = tableColumns.priceX + tableColumns.priceWidth;
    tableColumns.descriptionWidth = tableColumns.priceX - tableColumns.descriptionX - columnGap;

    const drawTableHeader = () => {
      ensureSpace(tableHeaderHeight + mm(5), false);
      setFill(DARK_GRAY);
      doc.rect(margins.left, y, contentWidth, tableHeaderHeight, 'F');
      setText(WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);

      const textY = y + tableHeaderHeight / 2 + 3;
      doc.text('DESCRIPCIÓN', tableColumns.descriptionX, textY, { baseline: 'middle' });
      doc.text('P. UD', tableColumns.priceRightX, textY, { align: 'right', baseline: 'middle' });
      doc.text('UDS', tableColumns.qtyCenterX, textY, { align: 'center', baseline: 'middle' });
      doc.text('TOTAL', tableColumns.totalX, textY, { align: 'right', baseline: 'middle' });

      setText([0, 0, 0]);
      y += tableHeaderHeight;
    };

    const measureSalesLegalNotice = () => {
      const legal = data.salesLegalNotice || SALES_LEGAL_NOTICE;
      const title = String(legal?.title || '').trim();
      const paragraphs = Array.isArray(legal?.paragraphs) ? legal.paragraphs.filter(Boolean) : [];
      const fontSize = 5.8;
      const titleLineStep = mm(2.9);
      const bodyLineStep = mm(2.7);
      const paragraphGap = mm(1.2);
      const topGap = mm(3.2);
      const textWidth = contentWidth;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      const titleLines = title ? doc.splitTextToSize(title, textWidth) : [];
      doc.setFont('helvetica', 'normal');
      const paragraphRows = paragraphs.map((paragraph) => {
        const lines = doc.splitTextToSize(String(paragraph), textWidth);
        return { lines: lines.length ? lines : [''] };
      });

      const titleHeight = titleLines.length * titleLineStep;
      const bodyHeight = paragraphRows.reduce(
        (sum, row, index) => sum + row.lines.length * bodyLineStep + (index < paragraphRows.length - 1 ? paragraphGap : 0),
        0
      );

      return {
        legal,
        fontSize,
        titleLineStep,
        bodyLineStep,
        paragraphGap,
        topGap,
        textWidth,
        titleLines,
        paragraphRows,
        totalHeight: topGap + titleHeight + bodyHeight,
      };
    };

    const measureTextHeight = (text, width, lineHeight) => {
      const lines = doc.splitTextToSize(String(text || 'Concepto'), width);
      return {
        lines: lines.length ? lines : [''],
        height: Math.max(1, lines.length) * lineHeight,
      };
    };

    const drawConceptRows = (conceptsMaxY) => {
      const lineHeight = mm(4.4);
      const verticalPadding = mm(1.9);
      const minRowHeight = mm(10);
      const descriptionWidth = tableColumns.descriptionWidth;

      data.concepts.forEach((line) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        const measuredDescription = measureTextHeight(line.concept || 'Concepto', descriptionWidth, lineHeight);
        const rowHeight = Math.max(minRowHeight, measuredDescription.height + verticalPadding * 2);

        if (y + rowHeight > conceptsMaxY && y > margins.top + tableHeaderHeight) {
          newPage(true);
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);

        const rowTop = y;
        const rowBottom = rowTop + rowHeight;
        const textY = rowTop + verticalPadding + lineHeight - mm(0.5);
        const amountY = rowTop + rowHeight / 2 + 3;

        doc.text(measuredDescription.lines, tableColumns.descriptionX, textY, {
          maxWidth: descriptionWidth,
          lineHeightFactor: 1.15,
        });

        doc.text(formatMoneyEs(line.unitPrice), tableColumns.priceRightX, amountY, {
          align: 'right',
          baseline: 'middle',
          maxWidth: tableColumns.priceWidth,
        });

        doc.text(String(line.quantity ?? 1).replace('.', ','), tableColumns.qtyCenterX, amountY, {
          align: 'center',
          baseline: 'middle',
          maxWidth: tableColumns.qtyWidth,
        });

        doc.text(formatMoneyEs(line.lineTotal), tableColumns.totalX, amountY, {
          align: 'right',
          baseline: 'middle',
          maxWidth: tableColumns.totalWidth,
        });

        setText(MID_GRAY);
        doc.setLineWidth(0.4);
        doc.line(margins.left, rowBottom, margins.left + contentWidth, rowBottom);
        setText([0, 0, 0]);

        y = rowBottom;
      });

      if (data.concepts.length <= 1) y += mm(6);
    };

    const drawSubtotal = (startY) => {
      const blockWidth = mm(64);
      const blockHeight = mm(10);
      const yPos = startY;

      const x = margins.left + contentWidth - blockWidth;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('SUBTOTAL', x + mm(3), yPos + blockHeight / 2 + 3, { baseline: 'middle' });
      doc.text(formatMoneyEs(data.subtotal), x + blockWidth - mm(3), yPos + blockHeight / 2 + 3, {
        align: 'right',
        baseline: 'middle',
      });

      setText(MID_GRAY);
      doc.setLineWidth(0.6);
      doc.line(x, yPos + blockHeight, x + blockWidth, yPos + blockHeight);
      setText([0, 0, 0]);
      return blockHeight;
    };

    const drawIvaTotalBar = (startY) => {
      const barHeight = mm(16);
      const yPos = startY;

      setFill(DARK_GRAY);
      doc.rect(margins.left, yPos, contentWidth, barHeight, 'F');

      const rightBlockX = margins.left + contentWidth * 0.54;
      const rightBlockW = contentWidth * 0.46;

      setText(WHITE);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(`IVA ${data.ivaPorcentaje}%`, rightBlockX + mm(3), yPos + mm(6.3));
      doc.text(formatMoneyEs(data.ivaImporte), rightBlockX + rightBlockW - mm(3), yPos + mm(6.3), { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.text(data.totalLabel || 'TOTAL', rightBlockX + mm(3), yPos + mm(12.7));
      doc.setFontSize(13.5);
      doc.text(formatMoneyEs(data.total), rightBlockX + rightBlockW - mm(3), yPos + mm(12.9), { align: 'right' });

      setText([0, 0, 0]);
      return barHeight;
    };


    const drawSalesLegalNotice = (startY, legalLayout) => {
      const { titleLines, paragraphRows, fontSize, topGap, titleLineStep, bodyLineStep, paragraphGap, textWidth } = legalLayout;
      let yPos = startY + topGap;
      if (titleLines.length) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fontSize);
        doc.text(titleLines, margins.left, yPos);
        yPos += titleLines.length * titleLineStep;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      paragraphRows.forEach((row, index) => {
        doc.text(row.lines, margins.left, yPos, { maxWidth: textWidth, lineHeightFactor: 1.05 });
        yPos += row.lines.length * bodyLineStep;
        if (index < paragraphRows.length - 1) yPos += paragraphGap;
      });
    };

    const drawSignatureAndBank = (startY) => {
      const stampW = mm(62);
      const stampH = mm(40);
      const rowHeight = stampH + mm(8);
      const bankLines = Array.isArray(data.bankInfoLines) ? data.bankInfoLines.filter(Boolean) : [];
      const bankHeight = bankLines.length ? mm(8) + bankLines.length * mm(4.5) : 0;
      const yPos = startY;

      const leftWidth = mm(48);
      const rightWidth = mm(46);
      const availableCenter = contentWidth - leftWidth - rightWidth;
      const centerX = margins.left + leftWidth + Math.max(0, (availableCenter - stampW) / 2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.8);
      doc.text('CONFORME CLIENTE:', margins.left, yPos + mm(5));

      // Hueco en blanco para sello físico (intencionalmente vacío)
      doc.setDrawColor(220, 220, 220);
      doc.rect(centerX, yPos, stampW, stampH, 'S');
      doc.setDrawColor(0, 0, 0);

      const rightX = margins.left + contentWidth - rightWidth;
      doc.text('FIRMADO:', rightX, yPos + mm(5));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(data.companyIssuer.razonSocial || '', rightX, yPos + mm(11));

      let tailY = yPos + rowHeight;
      if (bankLines.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.2);
        bankLines.forEach((line) => {
          doc.text(line, margins.left, tailY);
          tailY += mm(4.5);
        });
      }
      return rowHeight + bankHeight;
    };

    drawTopBar();
    issuerCustomerBlock();
    y = Math.max(margins.top, y - mm(4));
    drawTableHeader();
    const legalLayout = measureSalesLegalNotice();
    const subtotalHeight = mm(10);
    const subtotalGapTop = mm(6);
    const ivaGapTop = mm(5.2);
    const ivaHeight = mm(16);
    const signatureGapTop = mm(6);
    const signatureHeight = mm(48) + (Array.isArray(data.bankInfoLines) ? data.bankInfoLines.filter(Boolean).length * mm(4.5) : 0);
    const legalGapTop = mm(3);
    const bottomBlockHeight =
      subtotalGapTop + subtotalHeight + ivaGapTop + ivaHeight + signatureGapTop + signatureHeight + legalGapTop + legalLayout.totalHeight;
    const bottomBlockStartY = pageHeight - margins.bottom - bottomBlockHeight;
    const conceptsMaxY = bottomBlockStartY;
    drawConceptRows(conceptsMaxY);

    const subtotalY = bottomBlockStartY + subtotalGapTop;
    drawSubtotal(subtotalY);
    const ivaY = subtotalY + subtotalHeight + ivaGapTop;
    drawIvaTotalBar(ivaY);
    const signatureY = ivaY + ivaHeight + signatureGapTop;
    const drawnSignatureHeight = drawSignatureAndBank(signatureY);
    const legalY = signatureY + drawnSignatureHeight + legalGapTop;
    drawSalesLegalNotice(legalY, legalLayout);

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
