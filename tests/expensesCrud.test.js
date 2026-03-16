'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeExpensePayload,
  validateExpensePayload,
  filterExpenses,
  upsertExpense,
  removeExpense,
} = require('../services/expensesCrud.js');

test('create payload normalizes money and flags', () => {
  const row = normalizeExpensePayload({
    fecha: '2026-02-01',
    concepto: 'Material',
    base_imponible: '10.126',
    iva_porcentaje: '21',
    iva_importe: '2.126',
    total: '12.252',
    deducible: 1,
  });

  assert.equal(row.base_imponible, 10.13);
  assert.equal(row.iva_importe, 2.13);
  assert.equal(row.total, 12.25);
  assert.equal(row.deducible, true);
});

test('validate requires date and concept', () => {
  assert.equal(validateExpensePayload({ fecha: '', concepto: '' }), 'La fecha es obligatoria.');
  assert.equal(validateExpensePayload({ fecha: '2026-01-01', concepto: '' }), 'El concepto es obligatorio.');
  assert.equal(validateExpensePayload({ fecha: '2026-01-01', concepto: 'Ok' }), '');
});

test('filter by year quarter category and deductible', () => {
  const rows = [
    { id: 1, fecha: '2026-01-10', categoria: 'Alquiler', deducible: true },
    { id: 2, fecha: '2026-04-10', categoria: 'Repuestos', deducible: false },
    { id: 3, fecha: '2026-05-10', categoria: 'Repuestos', deducible: true },
  ];

  assert.deepEqual(filterExpenses(rows, { year: 2026, quarter: 2, category: 'repu', deductible: 'true' }).map(r => r.id), [3]);
});

test('upsert updates existing and inserts new', () => {
  const rows = [{ id: 1, concepto: 'A' }];
  const updated = upsertExpense(rows, { id: 1, concepto: 'B' });
  assert.equal(updated.length, 1);
  assert.equal(updated[0].concepto, 'B');

  const inserted = upsertExpense(updated, { id: 2, concepto: 'C' });
  assert.equal(inserted.length, 2);
  assert.equal(inserted[0].id, 2);
});

test('remove deletes by id', () => {
  const rows = [{ id: 1 }, { id: 2 }];
  const out = removeExpense(rows, 1);
  assert.deepEqual(out, [{ id: 2 }]);
});
