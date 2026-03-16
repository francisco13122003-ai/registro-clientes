'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isFiscalKind,
  getQuarterDateRange,
  selectFiscalTransactions,
  selectQuarterFiscalTransactions,
  selectQuarterDeductibleExpenses,
} = require('../services/fiscalSelectors.js');

test('isFiscalKind solo acepta ticket/factura', () => {
  assert.equal(isFiscalKind('ticket'), true);
  assert.equal(isFiscalKind('factura'), true);
  assert.equal(isFiscalKind('otro'), false);
  assert.equal(isFiscalKind('nico'), false);
});

test('selectFiscalTransactions filtra por tipo fiscal y flag computa_fiscalmente', () => {
  const rows = [
    { id: 'a', kind: 'ticket', computa_fiscalmente: true },
    { id: 'b', kind: 'factura', computa_fiscalmente: false },
    { id: 'c', kind: 'otro', computa_fiscalmente: true },
    { id: 'd', kind: 'factura', computa_fiscalmente: true },
  ];

  assert.deepEqual(selectFiscalTransactions(rows).map((r) => r.id), ['a', 'd']);
});

test('selectQuarterFiscalTransactions acota por trimestre', () => {
  const rows = [
    { id: 'q1', kind: 'ticket', computa_fiscalmente: true, tx_date: '2026-03-31' },
    { id: 'q2', kind: 'ticket', computa_fiscalmente: true, tx_date: '2026-04-01' },
  ];

  assert.deepEqual(selectQuarterFiscalTransactions(rows, 2026, 1).map((r) => r.id), ['q1']);
  assert.deepEqual(selectQuarterFiscalTransactions(rows, 2026, 2).map((r) => r.id), ['q2']);
});

test('selectQuarterDeductibleExpenses solo devuelve deducibles del trimestre', () => {
  const expenses = [
    { id: 'd1', deducible: true, fecha: '2026-01-02' },
    { id: 'd2', deducible: false, fecha: '2026-01-03' },
    { id: 'd3', deducible: true, fecha: '2026-05-01' },
  ];

  assert.deepEqual(selectQuarterDeductibleExpenses(expenses, 2026, 1).map((r) => r.id), ['d1']);
});

test('getQuarterDateRange retorna límites ISO correctos', () => {
  assert.deepEqual(getQuarterDateRange(2026, 1), { from: '2026-01-01', to: '2026-03-31' });
  assert.deepEqual(getQuarterDateRange(2026, 4), { from: '2026-10-01', to: '2026-12-31' });
});
