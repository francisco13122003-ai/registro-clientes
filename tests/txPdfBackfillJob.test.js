'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hasAssociatedPdf,
  pickTransactionsWithoutPdf,
  runTxPdfBackfillJob,
} = require('../services/txPdfBackfillJob.js');

test('hasAssociatedPdf detects by transaction_id and legacy filename', () => {
  const tx = { id: 'tx1' };
  const attachments = [
    { transaction_id: 'tx1', file_name: 'x.pdf' },
    { transaction_id: null, file_name: 'TX-tx2-ticket-2026-01-01.pdf' },
  ];

  assert.equal(hasAssociatedPdf(tx, attachments), true);
  assert.equal(hasAssociatedPdf({ id: 'tx2' }, attachments), true);
  assert.equal(hasAssociatedPdf({ id: 'tx3' }, attachments), false);
});

test('pickTransactionsWithoutPdf returns only missing ones', () => {
  const txs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const atts = [{ transaction_id: 'b' }];
  assert.deepEqual(pickTransactionsWithoutPdf(txs, atts).map((t) => t.id), ['a', 'c']);
});

test('runTxPdfBackfillJob is idempotent and supports retries', async () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const generated = new Set(['b']);
  let failOnce = true;

  const summary = await runTxPdfBackfillJob({
    batchSize: 2,
    maxBatches: 3,
    fetchBatch: async (cursor, size) => rows.slice(cursor, cursor + size),
    hasPdf: async (tx) => generated.has(tx.id),
    generatePdf: async (tx) => {
      if (tx.id === 'c' && failOnce) {
        failOnce = false;
        throw new Error('temp failure');
      }
      generated.add(tx.id);
    },
    logger: { info() {}, warn() {}, error() {} },
  });

  assert.equal(summary.scanned, 3);
  assert.equal(summary.generated, 1);
  assert.equal(summary.skippedExisting, 1);
  assert.equal(summary.failed, 1);

  const retrySummary = await runTxPdfBackfillJob({
    batchSize: 5,
    maxBatches: 1,
    fetchBatch: async () => rows,
    hasPdf: async (tx) => generated.has(tx.id),
    generatePdf: async (tx) => {
      generated.add(tx.id);
    },
    logger: { info() {}, warn() {}, error() {} },
  });

  assert.equal(retrySummary.generated, 1);
  assert.equal(retrySummary.failed, 0);
});
