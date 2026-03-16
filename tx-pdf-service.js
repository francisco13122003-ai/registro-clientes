(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TxPdfService = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FLOPITEC_LEGAL = Object.freeze({
    razonSocial: 'Luis Alemán Caballero',
    nif: '24255871W',
    direccion: 'C/ Pablo Iglesias 30 Bajo, 18140, La Zubia, Granada',
  });

  function toMoney(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }

  function buildTxPdfFileName({ txId, kind, txDate }) {
    const safeKind = String(kind || 'registro').toLowerCase();
    const safeDate = String(txDate || '').replace(/[^0-9\-]/g, '') || 'sin-fecha';
    return `TX-${String(txId || 'sin-id')}-${safeKind}-${safeDate}.pdf`;
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
      };
    }

    return {
      title: 'Documento de venta',
      name: `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Cliente',
      nif: '',
      address: customer?.address || '',
    };
  }

  function normalizeConceptLines(tx, items) {
    const normalizedItems = (items || [])
      .map((it) => ({
        concept: String(it?.concept || '').trim(),
        amount: toMoney(it?.amount),
      }))
      .filter((it) => it.concept || it.amount);

    if (normalizedItems.length) return normalizedItems;

    return [
      {
        concept: String(tx?.comments || 'Registro de venta/reparación').trim(),
        amount: toMoney(tx?.total_amount),
      },
    ];
  }

  function buildPdfData({ tx, items, customer, company, txCode }) {
    const recipient = buildRecipientBlock(customer, company);
    const concepts = normalizeConceptLines(tx, items);

    const subtotal = toMoney(concepts.reduce((sum, line) => sum + toMoney(line.amount), 0));
    const baseImponible = subtotal;
    const ivaPorcentaje = 21;
    const ivaImporte = toMoney(baseImponible * 0.21);
    const total = toMoney(baseImponible + ivaImporte);

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
    };
  }

  function renderPdfToJsPdf(data, jspdfCtor) {
    const doc = new jspdfCtor({ unit: 'pt', format: 'a4' });
    let y = 40;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Flopitec Servicios Informáticos', 40, y);
    y += 24;

    doc.setFontSize(13);
    doc.text(data.docTitle, 40, y);
    y += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Fecha: ${data.txDate || '—'}`, 40, y);
    doc.text(`Código: ${data.txCode || '—'}`, 280, y);
    y += 18;

    doc.setFont('helvetica', 'bold');
    doc.text('Datos del cliente/empresa', 40, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.text(`Nombre: ${data.recipient.name || '—'}`, 40, y); y += 14;
    if (data.recipient.nif) { doc.text(`NIF/CIF: ${data.recipient.nif}`, 40, y); y += 14; }
    if (data.recipient.address) { doc.text(`Dirección: ${data.recipient.address}`, 40, y); y += 14; }

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Datos de la empresa emisora', 40, y); y += 14;
    doc.setFont('helvetica', 'normal');
    doc.text(`Razón social: ${data.companyIssuer.razonSocial}`, 40, y); y += 14;
    doc.text(`NIF: ${data.companyIssuer.nif}`, 40, y); y += 14;
    doc.text(`Dirección: ${data.companyIssuer.direccion}`, 40, y); y += 20;

    doc.setFont('helvetica', 'bold');
    doc.text('Conceptos (precios sin IVA)', 40, y); y += 16;
    doc.setFont('helvetica', 'normal');

    data.concepts.forEach((line) => {
      if (y > 700) { doc.addPage(); y = 40; }
      const text = `${line.concept || 'Concepto'} — ${toMoney(line.amount).toFixed(2)} €`;
      const wrapped = doc.splitTextToSize(text, 500);
      doc.text(wrapped, 48, y);
      y += wrapped.length * 12 + 4;
    });

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`Subtotal sin IVA: ${data.subtotal.toFixed(2)} €`, 40, y); y += 14;
    doc.text(`Base imponible: ${data.baseImponible.toFixed(2)} €`, 40, y); y += 14;
    doc.text(`IVA ${data.ivaPorcentaje}%: ${data.ivaImporte.toFixed(2)} €`, 40, y); y += 14;
    doc.text(`Total: ${data.total.toFixed(2)} €`, 40, y); y += 24;

    doc.setFont('helvetica', 'normal');
    doc.text('Firmado:', 40, y);
    doc.line(95, y + 2, 350, y + 2);

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
