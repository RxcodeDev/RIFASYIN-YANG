/**
 * js/panel/ui.js
 * Renderizado de tabla, stats, modal y toast.
 * Sin innerHTML para formularios (seguridad) — DOM API para inputs.
 */
import { getBoletosFiltrados, getStats, getVendedores } from './store.js';

// ── Stats ─────────────────────────────────────────────────────────
export function renderStats() {
  const { total, pagado, apartado, disponible } = getStats();
  document.getElementById('stat-total').textContent      = total;
  document.getElementById('stat-pagado').textContent     = pagado;
  document.getElementById('stat-apartado').textContent   = apartado;
  document.getElementById('stat-disponible').textContent = disponible;
}

// ── Filtro de vendedores ──────────────────────────────────────────
export function renderFiltroVendedor() {
  const sel = document.getElementById('filter-vendedor');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos los vendedores</option>';
  getVendedores().forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    sel.appendChild(o);
  });
  sel.value = cur; // mantener selección si ya había una
}

// ── Tabla con lazy loading ────────────────────────────────────────
const BADGE = {
  Pagado:     'badge-pagado',
  Apartado:   'badge-apartado',
  Disponible: 'badge-disponible',
};

const PAGE_SIZE = 50;   // filas por lote
let   _allRows   = [];   // cache de filas del render actual
let   _loaded    = 0;    // cuántas filas ya se insertaron
let   _sentinel  = null; // elemento centinela para IntersectionObserver
let   _observer  = null; // instancia del observer (se reutiliza)
let   _cardsList = null; // contenedor de cards (vista mobile)

function _buildRow(b) {
  const estado     = b['Estado Boleto'] || 'Disponible';
  const badgeClass = BADGE[estado] ?? 'badge-disponible';
  const restante   = b['Restante'];
  const tr = document.createElement('tr');
  tr.dataset.num = b['No. Boleto'];
  tr.innerHTML = `
    <td><strong>${b['No. Boleto']}</strong></td>
    <td>${b['Nombre del Comprador'] || '<span style="opacity:.4">—</span>'}</td>
    <td>${b['Teléfono'] || '—'}</td>
    <td><span class="badge ${badgeClass}">${estado}</span></td>
    <td>${b['Estado Pago'] || '—'}</td>
    <td>${b['Vendedor'] || '—'}</td>
    <td>${b['Promotor'] || '—'}</td>
    <td>${b['Método de Pago'] || '—'}</td>
    <td style="color:${restante > 0 ? 'var(--oro)' : 'var(--muted)'}">${restante ? '$' + restante : '—'}</td>
    <td><button class="btn btn-ghost btn-sm" data-editar="${b['No. Boleto']}">Editar</button></td>
  `;
  return tr;
}

// ── BoletoCard component (mobile) ────────────────────────────────
function _buildCard(b) {
  const estado     = b['Estado Boleto'] || 'Disponible';
  const badgeClass = BADGE[estado] ?? 'badge-disponible';
  const restante   = b['Restante'];

  const rows = [
    ['Tel',      b['Teléfono']       || '—'],
    ['Vendedor', b['Vendedor']       || '—'],
    ['Promotor', b['Promotor']       || '—'],
    ['Método',   b['Método de Pago'] || '—'],
  ];
  if (restante > 0) rows.push(['Restante', `<span class="bc-restante">$${restante}</span>`]);

  const gridHTML = rows
    .map(([lbl, val]) => `<span class="bc-label">${lbl}</span><span class="bc-val">${val}</span>`)
    .join('');

  const card = document.createElement('div');
  card.className  = 'boleto-card';
  card.dataset.num = b['No. Boleto'];
  card.innerHTML = `
    <div class="bc-header">
      <span class="bc-num">#${b['No. Boleto']}</span>
      <span class="badge ${badgeClass}">${estado}</span>
    </div>
    <p class="bc-nombre">${b['Nombre del Comprador'] || '<em style="opacity:.4">Sin nombre</em>'}</p>
    <div class="bc-grid">${gridHTML}</div>
    <div class="bc-footer">
      <button class="btn btn-ghost btn-sm" data-editar="${b['No. Boleto']}">Editar</button>
    </div>
  `;
  return card;
}

function _renderAllCards() {
  if (!_cardsList) return;
  const frag = document.createDocumentFragment();
  _allRows.forEach(b => frag.appendChild(_buildCard(b)));
  _cardsList.appendChild(frag);
}

function _appendLote(tbody) {
  const lote = _allRows.slice(_loaded, _loaded + PAGE_SIZE);
  if (!lote.length) {
    // No quedan filas: desconectar observer y quitar centinela
    _observer?.disconnect();
    _sentinel?.remove();
    return;
  }
  const frag = document.createDocumentFragment();
  lote.forEach(b => frag.appendChild(_buildRow(b)));
  // Insertar antes del sentinel (o al final si ya se quitó)
  if (_sentinel && _sentinel.parentNode === tbody) {
    tbody.insertBefore(frag, _sentinel);
  } else {
    tbody.appendChild(frag);
  }
  _loaded += lote.length;
}

function _initObserver(tbody) {
  _observer?.disconnect();

  // Centinela: fila invisible al final de la tabla
  _sentinel = document.createElement('tr');
  _sentinel.setAttribute('aria-hidden', 'true');
  _sentinel.style.cssText = 'height:1px;visibility:hidden;';
  tbody.appendChild(_sentinel);

  _observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) _appendLote(tbody);
  }, { threshold: 0 });

  _observer.observe(_sentinel);
}

export function renderTabla() {
  const loader = document.getElementById('loader');
  const tabla  = document.getElementById('tabla');
  const empty  = document.getElementById('empty');
  const tbody  = document.getElementById('tbody');
  _cardsList   = document.getElementById('cards-list');

  loader.hidden        = true;
  tbody.innerHTML      = '';
  _cardsList.innerHTML = '';
  _observer?.disconnect();
  _sentinel = null;

  _allRows = getBoletosFiltrados();
  _loaded  = 0;

  if (_allRows.length === 0) {
    tabla.hidden      = true;
    _cardsList.hidden = true;
    empty.hidden      = false;
    return;
  }

  tabla.hidden      = false;
  _cardsList.hidden = false;
  empty.hidden      = true;

  _appendLote(tbody);                                    // lazy para tabla (desktop)
  _renderAllCards();                                     // completo para cards (mobile)
  if (_loaded < _allRows.length) _initObserver(tbody);
}

export function showLoader() {
  document.getElementById('loader').hidden      = false;
  document.getElementById('tabla').hidden       = true;
  document.getElementById('cards-list').hidden  = true;
  document.getElementById('empty').hidden       = true;
}

// ── Modal ─────────────────────────────────────────────────────────
const CAMPOS = [
  'f-num', 'f-nombre', 'f-tel', 'f-estado-boleto', 'f-estado-pago',
  'f-vendedor', 'f-promotor', 'f-metodo', 'f-restante',
  'f-fecha-limite', 'f-estado-apartado', 'f-id-cliente',
];
const MAPA_CAMPOS = {
  'f-num':             'No. Boleto',
  'f-nombre':          'Nombre del Comprador',
  'f-tel':             'Teléfono',
  'f-estado-boleto':   'Estado Boleto',
  'f-estado-pago':     'Estado Pago',
  'f-vendedor':        'Vendedor',
  'f-promotor':        'Promotor',
  'f-metodo':          'Método de Pago',
  'f-restante':        'Restante',
  'f-fecha-limite':    'Fecha Limite Apartado',
  'f-estado-apartado': 'Estado Apartado',
  'f-id-cliente':      'ID Cliente',
};

export function abrirModalNuevo() {
  CAMPOS.forEach(id => {
    const el = document.getElementById(id);
    el.value = el.tagName === 'SELECT'
      ? (id === 'f-estado-boleto'   ? 'Disponible'
        : id === 'f-estado-pago'    ? 'No pagado'
        : id === 'f-estado-apartado'? 'Activo' : '')
      : '';
  });
  document.getElementById('modal-title').innerHTML =
    'Nuevo <span>Boleto</span>';
  document.getElementById('f-num').readOnly = false;
  _abrirModal();
}

export function abrirModalEditar(boleto) {
  CAMPOS.forEach(id => {
    const col = MAPA_CAMPOS[id];
    document.getElementById(id).value = boleto[col] ?? '';
  });
  document.getElementById('modal-title').innerHTML =
    `Editar boleto <span>#${boleto['No. Boleto']}</span>`;
  document.getElementById('f-num').readOnly = true; // no cambiar el número en edición
  _abrirModal();
}

function _abrirModal() {
  document.getElementById('modal-overlay').classList.add('active');
}

export function cerrarModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

export function getDatosForm() {
  return Object.fromEntries(
    CAMPOS.map(id => [MAPA_CAMPOS[id], document.getElementById(id).value])
  );
}

// ── Toast ─────────────────────────────────────────────────────────
let _toastTimer = null;

export function toast(msg, error = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast show ${error ? 'toast-error' : 'toast-ok'}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}
