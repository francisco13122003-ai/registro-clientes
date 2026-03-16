'use strict';

const { calculateQuarterFiscalSnapshot, toMoney } = require('../fiscal-core.js');
const {
  selectQuarterFiscalTransactions,
  selectQuarterDeductibleExpenses,
} = require('./fiscalSelectors.js');

function readFiscalTotal(tx) {
  if (tx?.total_con_iva != null) return toMoney(tx.total_con_iva);
  return toMoney(tx?.total_amount);
}

function calculateQuarterFiscalResult({ transactions = [], expenses = [], year, quarter }) {
  const snapshot = calculateQuarterFiscalSnapshot({ transactions, expenses, year, quarter });
  const quarterFiscalTransactions = selectQuarterFiscalTransactions(transactions, year, quarter);
  const quarterDeductibleExpenses = selectQuarterDeductibleExpenses(expenses, year, quarter);

  const invoiceRows = quarterFiscalTransactions.filter((tx) => String(tx.kind).toLowerCase() === 'factura');
  const ticketRows = quarterFiscalTransactions.filter((tx) => String(tx.kind).toLowerCase() === 'ticket');

  return {
    year: Number(year),
    quarter: Number(quarter),
    invoices: { rows: invoiceRows, total: snapshot.invoicesTotal },
    tickets: { rows: ticketRows, aggregateTotal: snapshot.ticketAggregate },
    deductibleExpenses: { rows: quarterDeductibleExpenses, total: snapshot.deductibleExpensesTotal },
    fiscalQuarterResult: snapshot.provisionalProfit,
  };
}

module.exports = {
  calculateQuarterFiscalResult,
  readFiscalTotal,
  toMoney,
};
