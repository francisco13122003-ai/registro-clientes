'use strict';

const { shouldComputeFiscal } = require('../types/fiscal.js');

class FiscalBackfillService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async run(opts = {}) {
    const batchSize = Math.max(1, Number(opts.batchSize || 500));
    const dryRun = !!opts.dryRun;
    const logger = opts.logger || console;

    const { data, error } = await this.supabase
      .from('transactions')
      .select('id, kind, total_amount, subtotal_sin_iva, iva_porcentaje, iva_importe, total_con_iva, computa_fiscalmente')
      .limit(batchSize);

    if (error) throw error;

    const rows = data || [];
    let patched = 0;
    let missingTotal = 0;

    for (const tx of rows) {
      if (tx.total_amount == null) missingTotal += 1;

      const next = {
        subtotal_sin_iva: tx.subtotal_sin_iva ?? tx.total_amount ?? null,
        iva_porcentaje: tx.iva_porcentaje ?? 0,
        iva_importe: tx.iva_importe ?? 0,
        total_con_iva: tx.total_con_iva ?? tx.total_amount ?? null,
        computa_fiscalmente:
          shouldComputeFiscal(tx.kind),
      };

      const changed =
        tx.subtotal_sin_iva == null ||
        tx.iva_porcentaje == null ||
        tx.iva_importe == null ||
        tx.total_con_iva == null ||
        tx.computa_fiscalmente == null || tx.computa_fiscalmente !== shouldComputeFiscal(tx.kind);

      if (!changed) continue;
      patched += 1;

      if (dryRun) continue;

      const { error: updateError } = await this.supabase
        .from('transactions')
        .update(next)
        .eq('id', tx.id);

      if (updateError) {
        logger.error('[fiscal-backfill] error updating tx', { id: tx.id, error: updateError.message });
      }
    }

    if (missingTotal > 0) {
      logger.warn('[fiscal-backfill] transacciones sin total_amount: se mantienen en NULL para campos derivados', {
        missingTotal,
      });
    }

    logger.info('[fiscal-backfill] resumen', {
      scanned: rows.length,
      patched,
      dryRun,
    });

    return { scanned: rows.length, patched, missingTotal, dryRun };
  }
}

module.exports = {
  FiscalBackfillService,
};
