/**
 * js/panel/comprobantes.js
 * Galería de comprobantes subidos por los compradores.
 * Consume GET /api/uploads del upload-server local.
 * Cruza cada archivo con los datos del comprador desde el store en memoria.
 */
import { getBoletos } from './store.js';
import { sheets }     from './api.js';

let _items    = [];   // caché de archivos cargados
let _filtro   = '';   // búsqueda actual

// ── API ───────────────────────────────────────────────────────────

async function fetchComprobantes() {
  const res = await fetch('/api/uploads');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { ok, data, error } = await res.json();
  if (!ok) throw new Error(error ?? 'Error del servidor');
  return data;
}

// ── Dar de baja ───────────────────────────────────────────────────

async function _darDeBaja(item, btnEl) {
  const numStr = item.boleto ? `#${String(item.boleto).padStart(3, '0')}` : item.nombre;
  if (!confirm(`¿Dar de baja el boleto ${numStr}?\n\nEsto borrará el comprobante y dejará el boleto como Disponible.\nEsta acción no se puede deshacer.`)) return;

  btnEl.disabled    = true;
  btnEl.textContent = '…';

  try {
    // 1. Borrar archivo del servidor
    const res = await fetch(`/api/uploads/${encodeURIComponent(item.nombre)}`, { method: 'DELETE' });
    const { ok, error } = await res.json();
    if (!ok) throw new Error(error ?? 'Error al borrar archivo');

    // 2. Resetear boleto en el sheet si tiene número asignado
    // NOTE: Fecha de Venta y Fecha Límite Apartado se omiten — sus fórmulas
    // se recalculan solas al quedar Nombre del Comprador vacío.
    if (item.boleto) {
      await sheets.updateRecord(item.boleto, {
        'Nombre del Comprador':  '',
        'Teléfono':              '',
        'Estado Boleto':         'Disponible',
        'Estado Pago':           '',
        'Vendedor':              '',
        'Promotor':              '',
        'Método de Pago':        '',
        'Estado Apartado':       '',
        'ID Cliente':            '',
        'Cliente Repetido':      '',
        'AB1 ':                  '',
        'Restante ':             '',
      });
    }

    // 3. Quitar de la caché y re-renderizar
    _items = _items.filter(i => i.nombre !== item.nombre);
    _render();
  } catch (err) {
    console.error('[comprobantes] Error al dar de baja:', err);
    alert(`Error: ${err.message}`);
    btnEl.disabled    = false;
    btnEl.textContent = 'Dar de baja';
  }
}

// ── Render ────────────────────────────────────────────────────────

function _fmtBytes(n) {
  if (n < 1024)         return `${n} B`;
  if (n < 1024 * 1024)  return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function _fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

function _buildCard(item) {
  const esImagen = /^(jpg|jpeg|png|webp|gif)$/i.test(item.ext);
  const numStr   = item.boleto ? `#${String(item.boleto).padStart(3, '0')}` : '—';

  // Cruzar con datos del comprador en memoria
  const row    = getBoletos().find(b => Number(b['No. Boleto']) === item.boleto);
  const nombre = row?.['Nombre del Comprador']?.trim() || null;
  const tel    = row?.['Teléfono'] || null;
  const estado = row?.['Nombre del Comprador'] ? (row['Estado Boleto'] ?? '').trim() : null;

  const card = document.createElement('article');
  card.className   = 'cp-card';
  card.dataset.boleto = item.boleto ?? '';

  // Preview
  const preview = document.createElement('div');
  preview.className = 'cp-preview';

  if (esImagen) {
    const img = document.createElement('img');
    img.src     = item.url;
    img.alt     = `Comprobante boleto ${numStr}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('click', () => _openViewer(item));
    preview.appendChild(img);
  } else {
    // PDF — icono + botón abrir
    const icon = document.createElement('div');
    icon.className   = 'cp-pdf-icon';
    icon.textContent = 'PDF';
    icon.setAttribute('aria-hidden', 'true');
    preview.appendChild(icon);
    preview.addEventListener('click', () => window.open(item.url, '_blank', 'noopener'));
    preview.style.cursor = 'pointer';
  }

  // Info
  const info = document.createElement('div');
  info.className = 'cp-info';

  const badge = document.createElement('span');
  badge.className   = 'cp-badge';
  badge.textContent = `Boleto ${numStr}`;

  // Nombre del comprador
  if (nombre) {
    const nombreEl = document.createElement('span');
    nombreEl.className   = 'cp-nombre';
    nombreEl.textContent = nombre;
    info.appendChild(nombreEl);
  }

  // Teléfono
  if (tel) {
    const telEl = document.createElement('a');
    telEl.className   = 'cp-tel';
    telEl.href        = `tel:${tel}`;
    telEl.textContent = tel;
    info.appendChild(telEl);
  }

  // Estado del boleto
  if (estado) {
    const estadoEl = document.createElement('span');
    const BADGE_MAP = { Pagado: 'badge-pagado', Apartado: 'badge-apartado', Disponible: 'badge-disponible' };
    estadoEl.className   = `badge ${BADGE_MAP[estado] ?? 'badge-disponible'} cp-estado-badge`;
    estadoEl.textContent = estado;
    info.appendChild(estadoEl);
  }

  const fecha = document.createElement('time');
  fecha.className   = 'cp-fecha';
  fecha.textContent = _fmtFecha(item.fecha);

  const size = document.createElement('span');
  size.className   = 'cp-size';
  size.textContent = _fmtBytes(item.bytes);

  const actions = document.createElement('div');
  actions.className = 'cp-actions';

  const btnVer = document.createElement('a');
  btnVer.href      = item.url;
  btnVer.target    = '_blank';
  btnVer.rel       = 'noopener noreferrer';
  btnVer.className = 'btn btn-ghost btn-sm';
  btnVer.textContent = esImagen ? 'Ver' : 'Abrir';

  const btnDl = document.createElement('a');
  btnDl.href      = item.url;
  btnDl.download  = item.nombre;
  btnDl.className = 'btn btn-ghost btn-sm';
  btnDl.textContent = '↓';
  btnDl.setAttribute('aria-label', 'Descargar');

  const btnBaja = document.createElement('button');
  btnBaja.type      = 'button';
  btnBaja.className = 'btn btn-danger btn-sm';
  btnBaja.textContent = 'Dar de baja';
  btnBaja.addEventListener('click', () => _darDeBaja(item, btnBaja));

  actions.append(btnVer, btnDl, btnBaja);
  // badge siempre primero; el resto se insertó dinámicamente arriba
  info.prepend(badge);
  info.append(fecha, size, actions);
  card.append(preview, info);

  return card;
}

function _render() {
  const grid  = document.getElementById('cp-grid');
  const empty = document.getElementById('cp-empty');
  const count = document.getElementById('cp-count');

  const filtered = _filtro
    ? _items.filter(i => String(i.boleto ?? '').startsWith(_filtro))
    : _items;

  count.textContent = `${filtered.length} archivo${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    grid.hidden  = true;
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  grid.hidden  = false;
  grid.replaceChildren(...filtered.map(_buildCard));
}

// ── Visor de imagen ───────────────────────────────────────────────

function _openViewer(item) {
  const overlay = document.getElementById('cp-viewer-overlay');
  const content = document.getElementById('cp-viewer-content');
  const numStr  = item.boleto ? `#${String(item.boleto).padStart(3, '0')}` : '';

  const img = document.createElement('img');
  img.src = item.url;
  img.alt = `Comprobante boleto ${numStr}`;

  const caption = document.createElement('p');
  caption.className   = 'cp-viewer-caption';
  caption.textContent = `Boleto ${numStr} · ${_fmtFecha(item.fecha)}`;

  content.replaceChildren(img, caption);
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function _closeViewer() {
  document.getElementById('cp-viewer-overlay').hidden = true;
  document.getElementById('cp-viewer-content').replaceChildren();
  document.body.style.overflow = '';
}

// ── Carga pública ─────────────────────────────────────────────────

export async function cargarComprobantes() {
  const loader = document.getElementById('cp-loader');
  const grid   = document.getElementById('cp-grid');
  const empty  = document.getElementById('cp-empty');

  loader.hidden = false;
  grid.hidden   = true;
  empty.hidden  = true;

  try {
    _items = await fetchComprobantes();
    _render();
  } catch (err) {
    console.error('[comprobantes]', err);
    empty.textContent = 'Error al cargar comprobantes. Intenta de nuevo.';
    empty.hidden = false;
  } finally {
    loader.hidden = true;
  }
}

// ── Init — enlaza eventos internos ────────────────────────────────

export function initComprobantes() {
  document.getElementById('cp-recargar').addEventListener('click', cargarComprobantes);

  document.getElementById('cp-search').addEventListener('input', e => {
    _filtro = e.target.value.trim().replace(/\D/g, '');
    _render();
  });

  const overlay = document.getElementById('cp-viewer-overlay');
  document.getElementById('cp-viewer-close').addEventListener('click', _closeViewer);
  overlay.addEventListener('click', e => { if (e.target === overlay) _closeViewer(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.hidden) _closeViewer();
  });
}
