'use strict';

const FISCAL_COMPUTABLE_KINDS = Object.freeze(['ticket', 'factura']);

function shouldComputeFiscal(kind) {
  return FISCAL_COMPUTABLE_KINDS.includes(String(kind || '').toLowerCase());
}

function normalizeFiscalFromLegacy(tx) {
  const total = tx?.total_amount ?? null;

  return {
    subtotal_sin_iva: tx?.subtotal_sin_iva ?? total,
    iva_porcentaje: tx?.iva_porcentaje ?? 0,
    iva_importe: tx?.iva_importe ?? 0,
    total_con_iva: tx?.total_con_iva ?? total,
    computa_fiscalmente:
      typeof tx?.computa_fiscalmente === 'boolean'
        ? tx.computa_fiscalmente
        : shouldComputeFiscal(tx?.kind || ''),
  };
}

module.exports = {
  FISCAL_COMPUTABLE_KINDS,
  shouldComputeFiscal,
  normalizeFiscalFromLegacy,
};
