'use strict';

const FISCAL_KINDS = Object.freeze(['ticket', 'factura']);

function normalizeKind(kind) {
  return String(kind || '').trim().toLowerCase();
}

function isFiscalKind(kind) {
  return FISCAL_KINDS.includes(normalizeKind(kind));
}

function getQuarterDateRange(year, quarter) {
  const y = Number(year);
  const q = Number(quarter);
  if (!Number.isInteger(y) || y < 1900) throw new Error('Año inválido para selector fiscal.');
  if (![1, 2, 3, 4].includes(q)) throw new Error('Trimestre inválido para selector fiscal.');

  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(y, startMonth, 1));
  const end = new Date(Date.UTC(y, startMonth + 3, 0));

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function inIsoRange(dateText, from, to) {
  const value = String(dateText || '');
  return value >= from && value <= to;
}

function selectFiscalTransactions(transactions) {
  return (transactions || []).filter((tx) => {
    const kind = normalizeKind(tx?.kind);
    const byKind = isFiscalKind(kind);
    const byFlag = tx?.computa_fiscalmente == null ? byKind : !!tx.computa_fiscalmente;
    return byKind && byFlag;
  });
}

function selectQuarterFiscalTransactions(transactions, year, quarter) {
  const { from, to } = getQuarterDateRange(year, quarter);
  return selectFiscalTransactions(transactions).filter((tx) => inIsoRange(tx?.tx_date, from, to));
}

function selectQuarterDeductibleExpenses(expenses, year, quarter) {
  const { from, to } = getQuarterDateRange(year, quarter);
  return (expenses || []).filter((expense) => {
    return !!expense?.deducible && inIsoRange(expense?.fecha, from, to);
  });
}

function buildQuarterFiscalTransactionQuery(supabase, year, quarter) {
  const { from, to } = getQuarterDateRange(year, quarter);
  return supabase
    .from('transactions')
    .select('*')
    .in('kind', FISCAL_KINDS)
    .eq('computa_fiscalmente', true)
    .gte('tx_date', from)
    .lte('tx_date', to)
    .order('tx_date', { ascending: true })
    .order('created_at', { ascending: true });
}

function buildQuarterDeductibleExpenseQuery(supabase, year, quarter) {
  const { from, to } = getQuarterDateRange(year, quarter);
  return supabase
    .from('expenses')
    .select('*')
    .eq('deducible', true)
    .gte('fecha', from)
    .lte('fecha', to)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true });
}

module.exports = {
  FISCAL_KINDS,
  isFiscalKind,
  getQuarterDateRange,
  selectFiscalTransactions,
  selectQuarterFiscalTransactions,
  selectQuarterDeductibleExpenses,
  buildQuarterFiscalTransactionQuery,
  buildQuarterDeductibleExpenseQuery,
};
