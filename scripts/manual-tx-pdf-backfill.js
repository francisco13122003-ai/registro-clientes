/**
 * Manual browser job launcher.
 * Usage from console (after app login):
 *   await runManualTxPdfBackfill({ batchSize: 20, maxBatches: 10, dryRun: true })
 */
async function runManualTxPdfBackfill(options = {}) {
  if (!window.AppManualJobs?.backfillMissingTransactionPdfs) {
    throw new Error('AppManualJobs.backfillMissingTransactionPdfs no está disponible.');
  }

  return window.AppManualJobs.backfillMissingTransactionPdfs({
    batchSize: Number(options.batchSize || 20),
    maxBatches: Number(options.maxBatches || 10),
    startOffset: Number(options.startOffset || 0),
    dryRun: !!options.dryRun,
  });
}

if (typeof module === 'object' && module.exports) {
  module.exports = { runManualTxPdfBackfill };
}
