'use strict';

function toMoney(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function normalizeExpensePayload(payload = {}) {
  return {
    fecha: String(payload.fecha || ''),
    concepto: String(payload.concepto || '').trim(),
    categoria: String(payload.categoria || '').trim() || null,
    proveedor: String(payload.proveedor || '').trim() || null,
    base_imponible: toMoney(payload.base_imponible),
    iva_porcentaje: toMoney(payload.iva_porcentaje),
    iva_importe: toMoney(payload.iva_importe),
    total: toMoney(payload.total),
    deducible: !!payload.deducible,
    notas: String(payload.notas || '').trim() || null,
  };
}

function validateExpensePayload(payload = {}) {
  if (!String(payload.fecha || '').trim()) return 'La fecha es obligatoria.';
  if (!String(payload.concepto || '').trim()) return 'El concepto es obligatorio.';
  return '';
}

function getQuarterByMonthIndex(monthIndex) {
  return Math.floor(Number(monthIndex || 0) / 3) + 1;
}

function filterExpenses(expenses = [], filters = {}) {
  const year = String(filters.year || '').trim();
  const quarter = String(filters.quarter || '').trim();
  const category = String(filters.category || '').trim().toLowerCase();
  const deductible = String(filters.deductible || '').trim();

  return expenses.filter((exp) => {
    const fecha = String(exp.fecha || '');
    if (year && !fecha.startsWith(`${year}-`)) return false;

    if (quarter) {
      const d = new Date(`${fecha}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) return false;
      if (String(getQuarterByMonthIndex(d.getUTCMonth())) !== quarter) return false;
    }

    if (category && !String(exp.categoria || '').toLowerCase().includes(category)) return false;
    if (deductible === 'true' && !exp.deducible) return false;
    if (deductible === 'false' && !!exp.deducible) return false;

    return true;
  });
}

function upsertExpense(expenses = [], expense) {
  const list = [...expenses];
  const idx = list.findIndex((row) => String(row.id) === String(expense.id));
  if (idx >= 0) list[idx] = { ...list[idx], ...expense };
  else list.unshift(expense);
  return list;
}

function removeExpense(expenses = [], id) {
  return expenses.filter((row) => String(row.id) !== String(id));
}

module.exports = {
  toMoney,
  normalizeExpensePayload,
  validateExpensePayload,
  filterExpenses,
  upsertExpense,
  removeExpense,
};
