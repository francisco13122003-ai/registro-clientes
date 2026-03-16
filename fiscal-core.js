(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FiscalCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FISCAL_KINDS = Object.freeze(['ticket', 'factura']);

  function toMoney(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }

  function getQuarterByMonth(monthIndex) {
    return Math.floor(Number(monthIndex || 0) / 3) + 1;
  }

  function quarterRange(year, quarter) {
    const q = Number(quarter);
    const y = Number(year);
    if (![1, 2, 3, 4].includes(q)) throw new Error('Trimestre inválido');
    const startMonth = (q - 1) * 3;
    const from = new Date(Date.UTC(y, startMonth, 1)).toISOString().slice(0, 10);
    const to = new Date(Date.UTC(y, startMonth + 3, 0)).toISOString().slice(0, 10);
    return { from, to };
  }

  function inRange(isoDate, from, to) {
    const value = String(isoDate || '');
    return value >= from && value <= to;
  }

  function isComputableTx(tx) {
    const kind = String(tx?.kind || '').toLowerCase();
    if (!FISCAL_KINDS.includes(kind)) return false;
    const flag = tx?.computa_fiscalmente;
    return typeof flag === 'boolean' ? flag : true;
  }

  function readTxTotal(tx) {
    return toMoney(tx?.total_con_iva != null ? tx.total_con_iva : tx?.total_amount);
  }

  function readTxVat(tx) {
    return toMoney(tx?.iva_importe);
  }

  function readExpenseTotal(expense) {
    return toMoney(expense?.total);
  }

  function readExpenseVat(expense) {
    return toMoney(expense?.iva_importe);
  }

  function calculateQuarterFiscalSnapshot({ transactions = [], expenses = [], year, quarter }) {
    const { from, to } = quarterRange(year, quarter);

    const txQuarter = (transactions || []).filter((tx) => isComputableTx(tx) && inRange(tx?.tx_date, from, to));
    const tickets = txQuarter.filter((tx) => String(tx.kind).toLowerCase() === 'ticket');
    const invoices = txQuarter.filter((tx) => String(tx.kind).toLowerCase() === 'factura');

    const deductibleExpenses = (expenses || []).filter(
      (e) => !!e?.deducible && inRange(e?.fecha, from, to)
    );

    const ticketAggregate = toMoney(tickets.reduce((sum, tx) => sum + readTxTotal(tx), 0));
    const invoicesTotal = toMoney(invoices.reduce((sum, tx) => sum + readTxTotal(tx), 0));
    const computableIncome = toMoney(invoicesTotal + ticketAggregate);
    const deductibleExpensesTotal = toMoney(
      deductibleExpenses.reduce((sum, e) => sum + readExpenseTotal(e), 0)
    );
    const provisionalProfit = toMoney(computableIncome - deductibleExpensesTotal);

    const vatOnIncome = toMoney(txQuarter.reduce((sum, tx) => sum + readTxVat(tx), 0));
    const vatOnDeductibleExpenses = toMoney(
      deductibleExpenses.reduce((sum, e) => sum + readExpenseVat(e), 0)
    );
    const vatBalance = toMoney(vatOnIncome - vatOnDeductibleExpenses);

    return {
      year: Number(year),
      quarter: Number(quarter),
      computableIncome,
      ticketAggregate,
      invoicesTotal,
      deductibleExpensesTotal,
      provisionalProfit,
      vat: {
        onIncome: vatOnIncome,
        onDeductibleExpenses: vatOnDeductibleExpenses,
        balance: vatBalance,
      },
      counts: {
        invoices: invoices.length,
        tickets: tickets.length,
        deductibleExpenses: deductibleExpenses.length,
      },
    };
  }

  function calculateYearFiscalAccumulated({ transactions = [], expenses = [], year }) {
    const totals = { computableIncome: 0, deductibleExpenses: 0, provisionalProfit: 0, vatBalance: 0 };
    for (let q = 1; q <= 4; q += 1) {
      const s = calculateQuarterFiscalSnapshot({ transactions, expenses, year, quarter: q });
      totals.computableIncome = toMoney(totals.computableIncome + s.computableIncome);
      totals.deductibleExpenses = toMoney(totals.deductibleExpenses + s.deductibleExpensesTotal);
      totals.provisionalProfit = toMoney(totals.provisionalProfit + s.provisionalProfit);
      totals.vatBalance = toMoney(totals.vatBalance + s.vat.balance);
    }
    return { year: Number(year), ...totals };
  }

  return {
    FISCAL_KINDS,
    toMoney,
    getQuarterByMonth,
    quarterRange,
    calculateQuarterFiscalSnapshot,
    calculateYearFiscalAccumulated,
  };
});
