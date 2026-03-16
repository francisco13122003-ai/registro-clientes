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


  function buildFiscalCompareTableHTML({
    leftLabel,
    left,
    rightLabel,
    right,
    moneyFormatter = defaultMoney,
    mode = 'quarter',
  }) {
    const m = (v) => esc(moneyFormatter(v));

    const leftGastos = mode === 'year' ? left?.deductibleExpenses : left?.deductibleExpensesTotal;
    const rightGastos = mode === 'year' ? right?.deductibleExpenses : right?.deductibleExpensesTotal;

    const leftVatVentas = mode === 'year' ? left?.vatBalance + (left?.vat?.onDeductibleExpenses || 0) : left?.vat?.onIncome;
    const rightVatVentas = mode === 'year' ? right?.vatBalance + (right?.vat?.onDeductibleExpenses || 0) : right?.vat?.onIncome;

    const leftVatGastos = mode === 'year' ? left?.vat?.onDeductibleExpenses : left?.vat?.onDeductibleExpenses;
    const rightVatGastos = mode === 'year' ? right?.vat?.onDeductibleExpenses : right?.vat?.onDeductibleExpenses;

    const leftIvaResult = mode === 'year' ? left?.vatBalance : left?.vat?.balance;
    const rightIvaResult = mode === 'year' ? right?.vatBalance : right?.vat?.balance;

    return `
      <div class="accounting-table-wrap">
        <table class="table accounting-table">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>${esc(leftLabel || 'Actual')}</th>
              <th>${esc(rightLabel || 'Seleccionado')}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Ingresos computables (ticket + factura)</td><td class="mono">${m(left?.computableIncome || 0)}</td><td class="mono">${m(right?.computableIncome || 0)}</td></tr>
            <tr><td>Gastos</td><td class="mono">${m(leftGastos || 0)}</td><td class="mono">${m(rightGastos || 0)}</td></tr>
            <tr><td>Beneficio</td><td class="mono">${m(left?.provisionalProfit || 0)}</td><td class="mono">${m(right?.provisionalProfit || 0)}</td></tr>
            <tr><td>IVA ventas</td><td class="mono">${m(leftVatVentas || 0)}</td><td class="mono">${m(rightVatVentas || 0)}</td></tr>
            <tr><td>IVA gastos</td><td class="mono">${m(leftVatGastos || 0)}</td><td class="mono">${m(rightVatGastos || 0)}</td></tr>
            <tr><td>Resultado IVA</td><td class="mono">${m(leftIvaResult || 0)}</td><td class="mono">${m(rightIvaResult || 0)}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  return {
    buildFiscalCardsHTML,
    buildTicketAggregateLineHTML,
    buildYearAccumulatedHTML,
    buildFiscalCompareTableHTML,
  };
});
