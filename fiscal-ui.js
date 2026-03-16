(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FiscalUI = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function esc(text) {
    return String(text == null ? '' : text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function defaultMoney(value) {
    const n = Number(value || 0);
    return `${n.toFixed(2)} €`;
  }

  function buildFiscalCardsHTML(snapshot, moneyFormatter = defaultMoney) {
    const m = (v) => esc(moneyFormatter(v));
    return `
      <div class="summary-card">
        <span class="summary-label">Ingresos computables (trimestre)</span>
        <strong class="summary-value mono">${m(snapshot.computableIncome)}</strong>
        <div class="muted small">Facturas + tickets computables</div>
      </div>
      <div class="summary-card">
        <span class="summary-label">Gastos deducibles (trimestre)</span>
        <strong class="summary-value mono">${m(snapshot.deductibleExpensesTotal)}</strong>
        <div class="muted small">Desde tabla de gastos</div>
      </div>
      <div class="summary-card">
        <span class="summary-label">Beneficio provisional (trimestre)</span>
        <strong class="summary-value mono">${m(snapshot.provisionalProfit)}</strong>
        <div class="muted small">Ingresos computables - gastos deducibles</div>
      </div>
      <div class="summary-card">
        <span class="summary-label">Resumen IVA (trimestre)</span>
        <strong class="summary-value mono">${m(snapshot.vat.balance)}</strong>
        <div class="muted small">IVA repercutido ${m(snapshot.vat.onIncome)} · IVA deducible ${m(snapshot.vat.onDeductibleExpenses)}</div>
      </div>
    `;
  }

  function buildTicketAggregateLineHTML(snapshot, moneyFormatter = defaultMoney) {
    return `Agregado trimestral de tickets: <strong class="mono">${esc(moneyFormatter(snapshot.ticketAggregate))}</strong>`;
  }

  function buildYearAccumulatedHTML(yearAccumulated, moneyFormatter = defaultMoney) {
    const m = (v) => esc(moneyFormatter(v));
    return `
      <div class="row row-spaced wrap">
        <div class="muted">Año ${esc(yearAccumulated.year)}</div>
        <div class="muted">Ingresos computables: <strong class="mono">${m(yearAccumulated.computableIncome)}</strong></div>
        <div class="muted">Gastos deducibles: <strong class="mono">${m(yearAccumulated.deductibleExpenses)}</strong></div>
        <div class="muted">Beneficio provisional: <strong class="mono">${m(yearAccumulated.provisionalProfit)}</strong></div>
        <div class="muted">Saldo IVA: <strong class="mono">${m(yearAccumulated.vatBalance)}</strong></div>
      </div>
    `;
  }

  return {
    buildFiscalCardsHTML,
    buildTicketAggregateLineHTML,
    buildYearAccumulatedHTML,
  };
});
