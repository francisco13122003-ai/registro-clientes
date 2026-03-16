'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateQuarterFiscalResult } = require('../services/fiscalCalculations.js');

function tx({ id, kind, date, total, fiscal = true }) {
  return {
    id,
    kind,
    tx_date: date,
    total_amount: total,
    total_con_iva: total,
    computa_fiscalmente: fiscal,
  };
}

function expense({ id, date, total, deducible = true }) {
  return {
    id,
    fecha: date,
    total,
    deducible,
  };
}

test('trimestre con solo tickets: agregado trimestral interno y sin facturas', () => {
  const transactions = [
    tx({ id: 't1', kind: 'ticket', date: '2026-01-05', total: 100 }),
    tx({ id: 't2', kind: 'ticket', date: '2026-02-10', total: 150 }),
  ];

  const result = calculateQuarterFiscalResult({
    transactions,
    expenses: [],
    year: 2026,
    quarter: 1,
  });

  assert.equal(result.tickets.aggregateTotal, 250);
  assert.equal(result.invoices.total, 0);
  assert.equal(result.fiscalQuarterResult, 250);
  assert.equal(result.invoices.rows.length, 0);
  assert.equal(result.tickets.rows.length, 2);
});

test('trimestre con solo facturas: cómputo individual de facturas', () => {
  const transactions = [
    tx({ id: 'f1', kind: 'factura', date: '2026-01-08', total: 300 }),
    tx({ id: 'f2', kind: 'factura', date: '2026-03-20', total: 200 }),
  ];

  const result = calculateQuarterFiscalResult({
    transactions,
    expenses: [],
    year: 2026,
    quarter: 1,
  });

  assert.equal(result.invoices.total, 500);
  assert.equal(result.tickets.aggregateTotal, 0);
  assert.equal(result.fiscalQuarterResult, 500);
  assert.equal(result.invoices.rows.length, 2);
});

test('trimestre mixto: facturas + agregado tickets - gastos deducibles', () => {
  const transactions = [
    tx({ id: 'f1', kind: 'factura', date: '2026-04-03', total: 400 }),
    tx({ id: 't1', kind: 'ticket', date: '2026-04-10', total: 120 }),
    tx({ id: 't2', kind: 'ticket', date: '2026-06-30', total: 80 }),
  ];

  const expenses = [
    expense({ id: 'e1', date: '2026-05-01', total: 100, deducible: true }),
    expense({ id: 'e2', date: '2026-05-05', total: 50, deducible: false }),
  ];

  const result = calculateQuarterFiscalResult({
    transactions,
    expenses,
    year: 2026,
    quarter: 2,
  });

  assert.equal(result.invoices.total, 400);
  assert.equal(result.tickets.aggregateTotal, 200);
  assert.equal(result.deductibleExpenses.total, 100);
  assert.equal(result.fiscalQuarterResult, 500);
});

test('trimestre con otros/nico: deben ignorarse del cálculo fiscal', () => {
  const transactions = [
    tx({ id: 'o1', kind: 'otro', date: '2026-01-05', total: 999, fiscal: false }),
    tx({ id: 'n1', kind: 'nico', date: '2026-01-06', total: 888, fiscal: false }),
    tx({ id: 'f1', kind: 'factura', date: '2026-01-07', total: 100, fiscal: true }),
  ];

  const result = calculateQuarterFiscalResult({
    transactions,
    expenses: [],
    year: 2026,
    quarter: 1,
  });

  assert.equal(result.invoices.total, 100);
  assert.equal(result.tickets.aggregateTotal, 0);
  assert.equal(result.fiscalQuarterResult, 100);
  assert.deepEqual(result.invoices.rows.map((r) => r.id), ['f1']);
});
