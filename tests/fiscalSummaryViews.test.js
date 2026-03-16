'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateFiscalSummaryViews } = require('../fiscal-core.js');
const { buildFiscalCompareTableHTML } = require('../fiscal-ui.js');

test('calculateFiscalSummaryViews returns current and selected quarter/year summaries', () => {
  const views = calculateFiscalSummaryViews({
    transactions: [
      { kind: 'ticket', tx_date: '2026-01-05', total_amount: 100, iva_importe: 21, computa_fiscalmente: true },
      { kind: 'factura', tx_date: '2026-05-10', total_amount: 200, iva_importe: 42, computa_fiscalmente: true },
      { kind: 'nico', tx_date: '2026-05-11', total_amount: 999, iva_importe: 0, computa_fiscalmente: false },
    ],
    expenses: [
      { fecha: '2026-05-20', total: 50, iva_importe: 10.5, deducible: true },
      { fecha: '2026-05-21', total: 70, iva_importe: 14.7, deducible: false },
    ],
    selectedYear: 2026,
    selectedQuarter: 2,
    now: new Date('2026-05-25T12:00:00Z'),
  });

  assert.equal(views.currentQuarter.year, 2026);
  assert.equal(views.currentQuarter.quarter, 2);
  assert.equal(views.selectedQuarter.computableIncome, 200);
  assert.equal(views.selectedQuarter.deductibleExpensesTotal, 50);
  assert.equal(views.selectedQuarter.provisionalProfit, 150);
  assert.equal(views.selectedQuarter.vat.onIncome, 42);
  assert.equal(views.selectedQuarter.vat.onDeductibleExpenses, 10.5);
  assert.equal(views.selectedQuarter.vat.balance, 31.5);
});

test('buildFiscalCompareTableHTML renders expected rows', () => {
  const html = buildFiscalCompareTableHTML({
    leftLabel: 'Actual',
    left: {
      computableIncome: 100,
      deductibleExpensesTotal: 30,
      provisionalProfit: 70,
      vat: { onIncome: 21, onDeductibleExpenses: 6.3, balance: 14.7 },
    },
    rightLabel: 'Seleccionado',
    right: {
      computableIncome: 200,
      deductibleExpensesTotal: 80,
      provisionalProfit: 120,
      vat: { onIncome: 42, onDeductibleExpenses: 16.8, balance: 25.2 },
    },
    moneyFormatter: (v) => `${Number(v).toFixed(2)} €`,
    mode: 'quarter',
  });

  assert.match(html, /Ingresos computables/);
  assert.match(html, /Gastos/);
  assert.match(html, /Beneficio/);
  assert.match(html, /IVA ventas/);
  assert.match(html, /Resultado IVA/);
});
