'use strict';

/**
 * Determina si una transacción ya tiene PDF asociado
 * por transaction_id o patrón legacy de nombre.
 */
function hasAssociatedPdf(tx, attachments = []) {
  const txId = String(tx?.id || '');
  if (!txId) return false;

  return (attachments || []).some((att) => {
    const byTxId = String(att?.transaction_id || '') === txId;
    const byLegacyName = String(att?.file_name || '').startsWith(`TX-${txId}-`);
    return byTxId || byLegacyName;
  });
}

/**
 * Selecciona candidatas para backfill: solo sin PDF asociado.
 */
function pickTransactionsWithoutPdf(transactions = [], attachments = []) {
  return (transactions || []).filter((tx) => !hasAssociatedPdf(tx, attachments));
}

/**
 * Runner manual, por lotes e idempotente.
 *
 * @param {Object} deps
 * @param {(cursor:number,batchSize:number)=>Promise<Array>} deps.fetchBatch
 * @param {(tx:any)=>Promise<boolean>} deps.hasPdf
 * @param {(tx:any)=>Promise<any>} deps.generatePdf
 * @param {Pick<Console,'info'|'warn'|'error'>=} deps.logger
 * @param {number=} deps.batchSize
 * @param {number=} deps.maxBatches
 * @param {number=} deps.startCursor
 * @param {boolean=} deps.dryRun
 */
async function runTxPdfBackfillJob(deps) {
  const logger = deps?.logger || console;
  const batchSize = Math.max(1, Number(deps?.batchSize || 20));
  const maxBatches = Math.max(1, Number(deps?.maxBatches || 50));
  const startCursor = Math.max(0, Number(deps?.startCursor || 0));
  const dryRun = !!deps?.dryRun;

  let cursor = startCursor;
  let scanned = 0;
  let generated = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const rows = await deps.fetchBatch(cursor, batchSize);
    if (!rows || !rows.length) break;

    logger.info('[tx-pdf-backfill] batch-start', { batch: batch + 1, cursor, size: rows.length });

    for (const tx of rows) {
      scanned += 1;

      try {
        const exists = await deps.hasPdf(tx);
        if (exists) {
          skippedExisting += 1;
          logger.info('[tx-pdf-backfill] skip-existing', { txId: tx.id });
          continue;
        }

        if (dryRun) {
          logger.info('[tx-pdf-backfill] dry-run-generate', { txId: tx.id });
          generated += 1;
          continue;
        }

        await deps.generatePdf(tx);
        generated += 1;
        logger.info('[tx-pdf-backfill] generated', { txId: tx.id });
      } catch (error) {
        failed += 1;
        logger.error('[tx-pdf-backfill] failed', {
          txId: tx?.id,
          error: error?.message || String(error),
        });
      }
    }

    cursor += rows.length;
    if (rows.length < batchSize) break;
  }

  const summary = { scanned, generated, skippedExisting, failed, nextCursor: cursor, dryRun };
  logger.info('[tx-pdf-backfill] summary', summary);
  return summary;
}

module.exports = {
  hasAssociatedPdf,
  pickTransactionsWithoutPdf,
  runTxPdfBackfillJob,
};

