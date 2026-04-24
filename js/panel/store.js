/**
 * js/panel/store.js
 * Estado global del panel. Sin framework — módulo singleton con getters/setters.
 */

let _boletos  = [];  // todos los registros del sheet
let _filtro   = { busqueda: '', estado: '', vendedor: '' };

// ── Normalización de nombres ──────────────────────────────────────
// 1. Trim + colapsa espacios múltiples
// 2. NFD + elimina diacríticos → "Mamá"→"Mama", "Elmago"→"Elmago"
// 3. Title Case → "luis"→"Luis", "LUIS"→"Luis"
// Resultado: misma clave de agrupación para variantes tipográficas del mismo nombre.
function normalizeName(str) {
  if (!str) return str;
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos/diacríticos
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Boletos ───────────────────────────────────────────────────────
export function setBoletos(rows) {
  _boletos = rows.map(r => ({
    ...r,
    Vendedor: normalizeName(r['Vendedor']),
    Promotor: normalizeName(r['Promotor']),
  }));
}
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

// Claves de columnas de abonos — 'AB1 ' tiene espacio al final en el sheet
const AB_KEYS = ['AB1 ','AB2','AB3','AB4','AB5','AB6','AB7','AB8','AB9','AB10','AB11','AB12'];

// ── Stats (derivado) ──────────────────────────────────────────────
export function getStats() {
  const vendido = _boletos.filter(b => {
    // Tiene al menos un abono cargado (cualquier columna AB1-AB12 > 0)
    const tieneAbono = AB_KEYS.some(k => parseFloat(b[k] ?? b[k.trim()] ?? 0) > 0);
    // O está Apartado/Pagado (independientemente de abonos)
    const ocupado = b['Estado Boleto'] === 'Apartado' || b['Estado Boleto'] === 'Pagado';
    return tieneAbono || ocupado;
  }).length;

  return {
    total:      _boletos.length,
    pagado:     _boletos.filter(b => b['Estado Boleto'] === 'Pagado').length,
    apartado:   _boletos.filter(b => b['Estado Boleto'] === 'Apartado').length,
    disponible: _boletos.filter(b => b['Estado Boleto'] === 'Disponible').length,
    vendido,
  };
}

// ── Vendedores únicos (derivado) ──────────────────────────────────
export function getVendedores() {
  return [...new Set(_boletos.map(b => b['Vendedor']).filter(Boolean))].sort();
}

// ── Promotores únicos (derivado) ──────────────────────────────────
export function getPromotores() {
  return [...new Set(_boletos.map(b => b['Promotor']).filter(Boolean))].sort();
}

// ── Siguiente ID de cliente (CL-XXXX) ────────────────────────────
export function getNextClientId() {
  const nums = _boletos
    .map(b => b['ID Cliente'])
    .filter(id => /^CL-\d{4}$/.test(id))
    .map(id => parseInt(id.slice(3), 10));
  const max = nums.length ? Math.max(...nums) : 0;
  return `CL-${String(max + 1).padStart(4, '0')}`;
}

// ── Buscar boleto por teléfono (para autocompletado) ──────────────
export function findByTelefono(tel) {
  const t = String(tel).trim();
  return _boletos.find(b => String(b['Teléfono']).trim() === t) ?? null;
}
