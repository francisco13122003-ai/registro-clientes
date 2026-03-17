'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTxPdfFileName,
  buildPdfData,
  FLOPITEC_LEGAL,
} = require('../tx-pdf-service.js');

test('buildTxPdfFileName uses transaction code as exact PDF name', () => {
  const name = buildTxPdfFileName({ txCode: 'TK-00001-26' });
  assert.equal(name, 'TK-00001-26.pdf');
});

test('buildPdfData uses reverse VAT breakdown and keeps final total unchanged', () => {
  const data = buildPdfData({
    tx: { kind: 'factura', tx_date: '2026-03-16', total_amount: 100 },
    items: [{ concept: 'Reparación', amount: 100 }],
    customer: { is_company: true },
    company: { business_name: 'Empresa X', cif: 'B123', address: 'Calle 1', postal_code: '18000', city: 'Granada', province: 'Granada' },
    txCode: 'FC-00001-26',
  });

  assert.equal(data.docTitle, 'Factura');
  assert.equal(data.recipient.name, 'Empresa X');
  assert.equal(data.baseImponible, 82.64);
  assert.equal(data.ivaImporte, 17.36);
  assert.equal(data.total, 100);
  assert.equal(data.companyIssuer.nif, FLOPITEC_LEGAL.nif);
});

test('buildPdfData uses Documento de venta for private customer and fallback concept', () => {
  const data = buildPdfData({
    tx: { kind: 'ticket', tx_date: '2026-03-16', total_amount: 50, comments: 'Venta rápida' },
    items: [],
    customer: { is_company: false, first_name: 'Ana', last_name: 'López', address: 'Dirección X' },
    company: null,
    txCode: 'TK-00001-26',
  });

  assert.equal(data.docTitle, 'Documento de venta');
  assert.equal(data.recipient.name, 'Ana López');
  assert.equal(data.concepts.length, 1);
  assert.equal(data.concepts[0].concept, 'Venta rápida');
  assert.equal(data.baseImponible, 41.32);
  assert.equal(data.ivaImporte, 8.68);
  assert.equal(data.total, 50);
});
