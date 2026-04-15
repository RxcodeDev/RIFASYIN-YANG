/**
 * panel/js/ui.js
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

// ── Tabla ─────────────────────────────────────────────────────────
const BADGE = {
  Pagado:     'badge-pagado',
  Apartado:   'badge-apartado',
  Disponible: 'badge-disponible',
};

export function renderTabla() {
  const loader = document.getElementById('loader');
  const tabla  = document.getElementById('tabla');
  const empty  = document.getElementById('empty');
  const tbody  = document.getElementById('tbody');
  const rows   = getBoletosFiltrados();

  loader.hidden = true;
  tbody.innerHTML = '';

  if (rows.length === 0) {
    tabla.hidden = true;
    empty.hidden = false;
    return;
  }

  empty.hidden = false;
  tabla.hidden = false;
  empty.hidden = true;

  const frag = document.createDocumentFragment();

  rows.forEach(b => {
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
      <td>
        <button class="btn btn-ghost btn-sm" data-editar="${b['No. Boleto']}">Editar</button>
      </td>
    `;
    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
}

export function showLoader() {
  document.getElementById('loader').hidden = false;
  document.getElementById('tabla').hidden  = true;
  document.getElementById('empty').hidden  = true;
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
