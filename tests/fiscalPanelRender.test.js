'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateQuarterFiscalSnapshot } = require('../fiscal-core.js');
const {
  buildFiscalCardsHTML,
  buildTicketAggregateLineHTML,
  buildYearAccumulatedHTML,
} = require('../fiscal-ui.js');

test('render fiscal cards includes key totals and labels', () => {
  const snapshot = calculateQuarterFiscalSnapshot({
    transactions: [
      { kind: 'ticket', tx_date: '2026-01-02', total_amount: 100, iva_importe: 21, computa_fiscalmente: true },
      { kind: 'factura', tx_date: '2026-01-10', total_amount: 200, iva_importe: 42, computa_fiscalmente: true },
      { kind: 'otro', tx_date: '2026-01-11', total_amount: 999, iva_importe: 0, computa_fiscalmente: false },
    ],
    expenses: [{ fecha: '2026-01-12', deducible: true, total: 50, iva_importe: 10.5 }],
    year: 2026,
    quarter: 1,
  });

  const html = buildFiscalCardsHTML(snapshot, (v) => `${Number(v).toFixed(2)} €`);
  assert.match(html, /Ingresos computables \(trimestre\)/);
  assert.match(html, /300\.00 €/);
  assert.match(html, /Gastos deducibles \(trimestre\)/);
  assert.match(html, /50\.00 €/);
  assert.match(html, /Beneficio provisional \(trimestre\)/);
  assert.match(html, /250\.00 €/);
});

test('render info line includes quarterly ticket aggregate', () => {
  const line = buildTicketAggregateLineHTML({ ticketAggregate: 123.45 }, (v) => `${v} €`);
  assert.match(line, /Agregado trimestral de tickets/);
  assert.match(line, /123\.45 €/);
});

test('render year accumulated block includes annual labels', () => {
  const html = buildYearAccumulatedHTML(
    { year: 2026, computableIncome: 1000, deductibleExpenses: 300, provisionalProfit: 700, vatBalance: 147 },
    (v) => `${v} €`
  );

  assert.match(html, /Año 2026/);
  assert.match(html, /Ingresos computables/);
  assert.match(html, /Beneficio provisional/);
});
