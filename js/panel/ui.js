/**
 * js/panel/ui.js
 * Renderizado de tabla, stats, modal y toast.
 * Sin innerHTML para formularios (seguridad) — DOM API para inputs.
 */
import { getBoletosFiltrados, getBoletos, getStats, getVendedores, getPromotores, getNextClientId, findByTelefono } from './store.js';
import { initNumPicker, resetPicker, setPickerValue } from './num-picker.js';

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
    if (!el) return;
    el.value = el.tagName === 'SELECT'
      ? (id === 'f-estado-boleto'   ? 'Disponible'
        : id === 'f-estado-pago'    ? 'No pagado'
        : id === 'f-estado-apartado'? 'Activo' : '')
      : '';
  });
  // Defaults de negocio para boleto nuevo
  document.getElementById('f-restante').value   = '550';
  document.getElementById('f-id-cliente').value = getNextClientId();
  const hint = document.getElementById('tel-hint');
  if (hint) hint.hidden = true;

  document.getElementById('modal-title').innerHTML = 'Nuevo <span>Boleto</span>';
  resetPicker(); // limpia el picker y pone f-num.readOnly = false
  _abrirModal();
}

export function abrirModalEditar(boleto) {
  CAMPOS.forEach(id => {
    const col = MAPA_CAMPOS[id];
    const el  = document.getElementById(id);
    if (!el) return;
    el.value = boleto[col] ?? '';
  });
  const hint = document.getElementById('tel-hint');
  if (hint) hint.hidden = true;

  document.getElementById('modal-title').innerHTML =
    `Editar boleto <span>#${boleto['No. Boleto']}</span>`;
  setPickerValue(boleto['No. Boleto']); // deshabilita picker y muestra #num
  _abrirModal();
}

let _pickerInited = false;
function _abrirModal() {
  if (!_pickerInited) { initNumPicker(); _pickerInited = true; }
  _populateDataLists();
  _bindCascadeOnce();
  _clearErrors();
  document.getElementById('modal-overlay').classList.add('active');
}

export function cerrarModal() {
  _clearErrors();
  document.getElementById('modal-overlay').classList.remove('active');
}

export function getDatosForm() {
  return Object.fromEntries(
    CAMPOS.map(id => [MAPA_CAMPOS[id], document.getElementById(id).value])
  );
}

// ── Selects de catálogo: se rellenan con datos en vivo del store ───
function _populateDataLists() {
  const fillSelect = (id, items) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value; // preserva el valor si ya había uno
    sel.innerHTML = '<option value="">— Seleccionar —</option>';
    const frag = document.createDocumentFragment();
    items.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      frag.appendChild(opt);
    });
    sel.appendChild(frag);
    sel.value = current; // restaurar selección previa
  };
  fillSelect('f-vendedor', getVendedores());
  fillSelect('f-promotor', getPromotores());
}

// ── Cascade estado ↔ pago ↔ restante (se enlaza una sola vez) ─────
let _cascadeBound = false;

function _bindCascadeOnce() {
  if (_cascadeBound) return;
  _cascadeBound = true;

  const estadoBoleto = document.getElementById('f-estado-boleto');
  const estadoPago   = document.getElementById('f-estado-pago');
  const restante     = document.getElementById('f-restante');
  const telInput     = document.getElementById('f-tel');

  estadoBoleto.addEventListener('change', () => {
    const e = estadoBoleto.value;
    if (e === 'Pagado') {
      estadoPago.value = 'Pagado';
      restante.value   = '0';
    } else if (e === 'Disponible') {
      estadoPago.value = 'No pagado';
      restante.value   = '550';
    } else if (e === 'Apartado') {
      // Solo bajar si estaba en Pagado
      if (estadoPago.value === 'Pagado') estadoPago.value = 'No pagado';
    }
    _clearErrors();
  });

  estadoPago.addEventListener('change', () => {
    if (estadoPago.value === 'Pagado') {
      estadoBoleto.value = 'Pagado';
      restante.value     = '0';
    }
    _clearErrors();
  });

  // Autocompletado por teléfono: si el teléfono ya existe en el sheet,
  // rellena nombre e ID cliente si están vacíos
  telInput.addEventListener('blur', () => {
    const t = telInput.value.trim();
    if (t.length !== 10) return;
    const match = findByTelefono(t);
    if (!match) return;

    let filled = false;
    const nombreEl = document.getElementById('f-nombre');
    if (!nombreEl.value.trim() && match['Nombre del Comprador']) {
      nombreEl.value = match['Nombre del Comprador'];
      filled = true;
    }
    const idEl = document.getElementById('f-id-cliente');
    if (!idEl.value.trim() && match['ID Cliente']) {
      idEl.value = match['ID Cliente'];
      filled = true;
    }
    const hint = document.getElementById('tel-hint');
    if (hint && match['Nombre del Comprador']) {
      hint.textContent = `⚠️ Cliente repetido: ${match['Nombre del Comprador']}`;
      hint.hidden = false;
    }
    if (filled) toast(`Cliente encontrado: ${match['Nombre del Comprador'] || match['ID Cliente']}`);
  });
}

// ── Validación de negocio ─────────────────────────────────────────
function _clearErrors() {
  document.querySelectorAll('.modal .invalid').forEach(el => el.classList.remove('invalid'));
  document.querySelectorAll('.modal .form-error-msg').forEach(el => el.remove());
}

export function validateForm(esEdicion) {
  _clearErrors();
  const errors = [];
  const get    = id => document.getElementById(id).value.trim();

  const numStr    = get('f-num');
  const num       = parseInt(numStr, 10);
  const nombre    = get('f-nombre');
  const tel       = get('f-tel');
  const estado    = get('f-estado-boleto');
  const pago      = get('f-estado-pago');
  const metodo    = get('f-metodo');
  const restStr   = get('f-restante');
  const restante  = restStr !== '' ? parseFloat(restStr) : null;
  const fechaLim  = get('f-fecha-limite');
  const vendedor  = get('f-vendedor');
  const idCliente = get('f-id-cliente');

  // No. Boleto: rango 1–1100, ocupado solo si ya está Apartado o Pagado
  if (!numStr || isNaN(num) || num < 1 || num > 1100) {
    errors.push({ id: 'f-num', msg: 'Número inválido (1–1100)' });
  } else if (!esEdicion) {
    const exists = getBoletos().find(
      b => b['No. Boleto'] == num && b['Estado Boleto'] !== 'Disponible'
    );
    if (exists) errors.push({ id: 'f-num', msg: `El boleto #${num} ya está ${exists['Estado Boleto']}` });
  }

  // Teléfono: exactamente 10 dígitos
  if (tel && !/^\d{10}$/.test(tel)) {
    errors.push({ id: 'f-tel', msg: 'Debe ser exactamente 10 dígitos' });
  }

  // Campos requeridos para boletos no disponibles
  if (estado !== 'Disponible') {
    if (!nombre)  errors.push({ id: 'f-nombre',   msg: 'Nombre requerido' });
    if (!tel)     errors.push({ id: 'f-tel',       msg: 'Teléfono requerido' });
    if (!metodo)  errors.push({ id: 'f-metodo',    msg: 'Método de pago requerido' });
    if (!vendedor) errors.push({ id: 'f-vendedor', msg: 'Vendedor requerido' });
  }

  // Consistencia: Estado Boleto = Pagado ↔ Estado Pago = Pagado
  if (estado === 'Pagado' && pago !== 'Pagado') {
    errors.push({ id: 'f-estado-pago', msg: 'Debe ser "Pagado" cuando el boleto está pagado' });
  }

  // Consistencia: Pagado → Restante debe ser $0
  if (pago === 'Pagado' && restante !== null && restante !== 0) {
    errors.push({ id: 'f-restante', msg: 'Restante debe ser $0 si el pago está completo' });
  }

  // Restante: rango $0–$550
  if (restante !== null && (isNaN(restante) || restante < 0 || restante > 550)) {
    errors.push({ id: 'f-restante', msg: 'Valor entre $0 y $550' });
  }

  // Fecha límite requerida si Apartado; no puede ser en el pasado
  if (estado === 'Apartado') {
    if (!fechaLim) {
      errors.push({ id: 'f-fecha-limite', msg: 'Fecha límite requerida para apartados' });
    } else {
      const hoy = new Date().toISOString().split('T')[0];
      if (fechaLim < hoy) {
        errors.push({ id: 'f-fecha-limite', msg: 'La fecha no puede ser en el pasado' });
      }
    }
  }

  // ID Cliente: formato CL-0001
  if (idCliente && !/^CL-\d{4}$/.test(idCliente)) {
    errors.push({ id: 'f-id-cliente', msg: 'Formato: CL-0001' });
  }

  // Marcar campos inválidos y agregar mensaje bajo el input
  // f-num es hidden; el elemento visual es np-trigger
  errors.forEach(({ id, msg }) => {
    const el      = document.getElementById(id);
    const markEl  = id === 'f-num' ? document.getElementById('np-trigger') : el;
    const group   = el?.closest('.form-group') ?? document.getElementById('fg-num');
    markEl?.classList.add('invalid');
    if (group) {
      const span = document.createElement('span');
      span.className   = 'form-error-msg';
      span.textContent = msg;
      group.appendChild(span);
    }
  });

  return errors.length === 0;
}

export function toast(msg, error = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast show ${error ? 'toast-error' : 'toast-ok'}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ══════════════════════════════════════════════════════════════════
// DASHBOARD — Canvas charts (no external deps)
// ══════════════════════════════════════════════════════════════════

let _dashStats      = null;
let _dashVendors    = null;
let _dashResizeTimer = null;
let _toastTimer     = null;

// Resize handler: redraws charts when viewport changes
window.addEventListener('resize', () => {
  if (!_dashStats) return;
  clearTimeout(_dashResizeTimer);
  _dashResizeTimer = setTimeout(() => {
    document.fonts.ready.then(() => {
      _drawDonut(document.getElementById('chart-estados'), _dashStats);
      _drawVendorBars(document.getElementById('chart-vendedores'), _dashVendors);
    });
  }, 200);
});

// ── Helpers ───────────────────────────────────────────────────────

/** Configura canvas para DPR y devuelve contexto + dimensiones CSS. */
function _canvasSetup(canvas, cssH) {
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const W    = rect.width  || 240;
  const H    = cssH !== undefined ? cssH : (rect.height || W);
  if (cssH !== undefined) canvas.style.height = cssH + 'px';
  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, W, H };
}

/** Construye datos de vendedores agrupados por estado, ordenados por total desc. */
function _vendorData() {
  const map = {};
  getBoletos().forEach(b => {
    const v = b['Vendedor'] || '—';
    const e = b['Estado Boleto'] || 'Disponible';
    if (!map[v]) map[v] = { pagado: 0, apartado: 0, disponible: 0 };
    if      (e === 'Pagado')   map[v].pagado++;
    else if (e === 'Apartado') map[v].apartado++;
    else                       map[v].disponible++;
  });
  return Object.entries(map)
    .map(([name, c]) => ({ name, ...c, total: c.pagado + c.apartado + c.disponible }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

/** Dibuja la gráfica de dona de estados. */
function _drawDonut(canvas, { pagado, apartado, disponible, total }) {
  if (!canvas) return;
  const { ctx, W, H } = _canvasSetup(canvas);
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const R  = Math.min(W, H) * 0.41;
  const ir = R * 0.58;

  if (!total) {
    ctx.beginPath();
    ctx.arc(cx, cy, R,  0, Math.PI * 2);
    ctx.arc(cx, cy, ir, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fill('evenodd');
    return;
  }

  const segs = [
    { val: pagado,     color: '#4ade80' },
    { val: apartado,   color: '#ffd55a' },
    { val: disponible, color: 'rgba(255,255,255,.07)' },
  ].filter(s => s.val > 0);

  const GAP = segs.length > 1 ? 0.04 : 0;
  let angle = -Math.PI / 2;

  segs.forEach(seg => {
    const sweep = (seg.val / total) * Math.PI * 2 - GAP;
    ctx.beginPath();
    ctx.arc(cx, cy, R,  angle + GAP / 2, angle + GAP / 2 + sweep);
    ctx.arc(cx, cy, ir, angle + GAP / 2 + sweep, angle + GAP / 2, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    angle += sweep + GAP;
  });

  // Texto central
  const pct = Math.round(((pagado + apartado) / total) * 100);
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd55a';
  ctx.font      = `bold ${Math.round(R * 0.52)}px 'Bebas Neue', sans-serif`;
  ctx.fillText(pct + '%', cx, cy - R * 0.09);
  ctx.fillStyle = 'rgba(255,220,160,.5)';
  ctx.font      = `${Math.round(R * 0.18)}px 'Barlow Condensed', sans-serif`;
  ctx.fillText('VENDIDOS', cx, cy + R * 0.24);
}

/** Dibuja barras horizontales apiladas por vendedor. */
function _drawVendorBars(canvas, vendors) {
  if (!canvas || !vendors.length) return;

  const ROW_H  = 38;
  const BAR_H  = 14;
  const PAD_T  = 10;
  const PAD_B  = 10;
  const NUM_W  = 32;
  const maxLen = Math.min(Math.max(...vendors.map(v => v.name.length)), 14);
  const LABEL_W = Math.min(Math.max(maxLen * 7, 68), 108);

  const cssH = vendors.length * ROW_H + PAD_T + PAD_B;
  const { ctx, W } = _canvasSetup(canvas, cssH);

  const BAR_W  = W - LABEL_W - NUM_W;
  const maxTot = Math.max(...vendors.map(v => v.total));

  vendors.forEach(({ name, pagado, apartado, total }, i) => {
    const rowY = PAD_T + i * ROW_H;
    const barY = rowY + (ROW_H - BAR_H) / 2;
    const barX = LABEL_W;

    // Fila alterna sutil
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,.02)';
      ctx.fillRect(0, rowY, W, ROW_H);
    }

    // Etiqueta vendedor
    const label = name.length > 13 ? name.slice(0, 12) + '…' : name;
    ctx.fillStyle    = 'rgba(255,220,160,.65)';
    ctx.font         = "500 11px 'Barlow Condensed', sans-serif";
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, barX - 6, barY + BAR_H / 2);

    // Pista de fondo
    ctx.beginPath();
    ctx.roundRect(barX, barY, BAR_W, BAR_H, 3);
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fill();

    // Segmento Pagado
    let xCur = barX;
    if (pagado) {
      const w = Math.max((pagado / maxTot) * BAR_W, 2);
      ctx.beginPath();
      ctx.roundRect(xCur, barY, w, BAR_H, pagado === total ? 3 : [3, 0, 0, 3]);
      ctx.fillStyle = '#4ade80';
      ctx.fill();
      xCur += w;
    }

    // Segmento Apartado
    if (apartado) {
      const w = Math.max((apartado / maxTot) * BAR_W, 2);
      ctx.beginPath();
      const r = pagado ? (xCur - barX + w >= BAR_W ? [0, 3, 3, 0] : 0) : [3, 0, 0, 3];
      ctx.roundRect(xCur, barY, w, BAR_H, r);
      ctx.fillStyle = '#ffd55a';
      ctx.fill();
    }

    // Contador
    ctx.fillStyle    = 'rgba(255,220,160,.85)';
    ctx.font         = "600 11px 'Barlow Condensed', sans-serif";
    ctx.textAlign    = 'left';
    ctx.fillText(total, barX + BAR_W + 6, barY + BAR_H / 2);
  });
}

/** Actualiza la lista de leyenda del donut. */
function _renderLegend({ pagado, apartado, disponible }) {
  const el = document.getElementById('legend-estados');
  if (!el) return;
  el.innerHTML = '';
  const items = [
    { label: 'Pagado',     val: pagado,     color: '#4ade80' },
    { label: 'Apartado',   val: apartado,   color: '#ffd55a' },
    { label: 'Disponible', val: disponible, color: 'rgba(200,200,200,.25)' },
  ];
  items.forEach(({ label, val, color }) => {
    const li    = document.createElement('li');
    const left  = document.createElement('span');
    left.className = 'chart-legend-left';
    const dot   = document.createElement('span');
    dot.className = 'chart-legend-dot';
    dot.style.background = color;
    left.append(dot, document.createTextNode(label));
    const num = document.createElement('span');
    num.className   = 'chart-legend-num';
    num.textContent = val;
    li.append(left, num);
    el.appendChild(li);
  });
}

// ── Export principal ──────────────────────────────────────────────

export function renderDashboard() {
  const dashboard = document.getElementById('dashboard');
  if (!dashboard) return;

  const stats   = getStats();
  const vendors = _vendorData();
  const { pagado, apartado, total } = stats;

  // Mostrar sección + activar grid de 2 columnas
  dashboard.hidden = false;
  document.getElementById('split-view')?.classList.add('has-dashboard');

  // Barra de progreso (CSS puro)
  const pPagado   = total ? (pagado   / total * 100).toFixed(2) : 0;
  const pApartado = total ? (apartado / total * 100).toFixed(2) : 0;
  const pPct      = total ? Math.round((pagado + apartado) / total * 100) : 0;
  document.getElementById('dp-seg-pagado').style.width   = pPagado   + '%';
  document.getElementById('dp-seg-apartado').style.width = pApartado + '%';
  document.getElementById('dp-pct').textContent          = pPct + '%';

  // Leyenda texto
  _renderLegend(stats);

  // Guardar estado para resize
  _dashStats   = stats;
  _dashVendors = vendors;

  // Dibujar canvas tras layout + carga de fuentes
  document.fonts.ready.then(() =>
    requestAnimationFrame(() => {
      _drawDonut(document.getElementById('chart-estados'), stats);
      _drawVendorBars(document.getElementById('chart-vendedores'), vendors);
    })
  );
}
