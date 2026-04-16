/**
 * js/panel/store.js
 * Estado global del panel. Sin framework — módulo singleton con getters/setters.
 */

let _boletos  = [];  // todos los registros del sheet
let _filtro   = { busqueda: '', estado: '', vendedor: '' };

// ── Boletos ───────────────────────────────────────────────────────
export function setBoletos(rows) { _boletos = rows; }
export function getBoletos()     { return _boletos; }

// ── Filtros ───────────────────────────────────────────────────────
export function setFiltro(key, value) { _filtro[key] = value; }
export function getFiltro()           { return { ..._filtro }; }

// ── Boletos filtrados (derivado, no almacenado) ───────────────────
export function getBoletosFiltrados() {
  const { busqueda, estado, vendedor } = _filtro;
  return _boletos.filter(b => {
    const num    = String(b['No. Boleto'] || '');
    const nombre = (b['Nombre del Comprador'] || '').toLowerCase();
    const tel    = String(b['Teléfono'] || '');
    const q      = busqueda.toLowerCase();

    const matchQ = !q || num.includes(q) || nombre.includes(q) || tel.includes(q);
    const matchE = !estado   || b['Estado Boleto'] === estado;
    const matchV = !vendedor || b['Vendedor']       === vendedor;
    return matchQ && matchE && matchV;
  });
}

// ── Stats (derivado) ──────────────────────────────────────────────
export function getStats() {
  return {
    total:      _boletos.length,
    pagado:     _boletos.filter(b => b['Estado Boleto'] === 'Pagado').length,
    apartado:   _boletos.filter(b => b['Estado Boleto'] === 'Apartado').length,
    disponible: _boletos.filter(b => b['Estado Boleto'] === 'Disponible').length,
  };
}

// ── Vendedores únicos (derivado) ──────────────────────────────────
export function getVendedores() {
  return [...new Set(_boletos.map(b => b['Vendedor']).filter(Boolean))].sort();
}
