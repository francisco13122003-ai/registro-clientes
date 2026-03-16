'use strict';

const { normalizeFiscalFromLegacy } = require('../types/fiscal.js');
const {
  buildQuarterFiscalTransactionQuery,
  buildQuarterDeductibleExpenseQuery,
} = require('./fiscalSelectors.js');

class FiscalRepository {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async listTransactionsWithFiscal(opts = {}) {
    const limit = Math.max(1, Number(opts.limit || 1000));

    const { data, error } = await this.supabase
      .from('transactions')
      .select(
        'id, kind, tx_date, customer_id, total_amount, subtotal_sin_iva, iva_porcentaje, iva_importe, total_con_iva, computa_fiscalmente, created_at'
      )
      .order('tx_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row) => ({
      ...row,
      ...normalizeFiscalFromLegacy(row),
    }));
  }

  async listQuarterFiscalTransactions(year, quarter) {
    const { data, error } = await buildQuarterFiscalTransactionQuery(this.supabase, year, quarter);
    if (error) throw error;
    return (data || []).map((row) => ({ ...row, ...normalizeFiscalFromLegacy(row) }));
  }

  async listQuarterDeductibleExpenses(year, quarter) {
    const { data, error } = await buildQuarterDeductibleExpenseQuery(this.supabase, year, quarter);
    if (error) throw error;
    return data || [];
  }

  async createExpense(payload) {
    const { data, error } = await this.supabase
      .from('expenses')
      .insert({
        fecha: payload.fecha,
        concepto: payload.concepto,
        categoria: payload.categoria || null,
        proveedor: payload.proveedor || null,
        base_imponible: payload.base_imponible ?? null,
        iva_porcentaje: payload.iva_porcentaje ?? null,
        iva_importe: payload.iva_importe ?? null,
        total: payload.total ?? null,
        deducible: !!payload.deducible,
        notas: payload.notas || null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = {
  FiscalRepository,
};
