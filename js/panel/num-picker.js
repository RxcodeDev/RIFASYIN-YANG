/**
 * js/panel/num-picker.js
 * Custom select-picker para números de boleto disponibles.
 * Sin dependencias externas. Soporta búsqueda, navegación con teclado
 * y modo readonly (edición de boleto existente).
 */
import { getBoletos } from './store.js';

const TOTAL = 1100;
const $     = id => document.getElementById(id);

let _isOpen = false;

// ── Init ─────────────────────────────────────────────────────────
// Debe llamarse una sola vez; los IDs deben existir en el DOM.
export function initNumPicker() {
  $('np-trigger').addEventListener('click', _toggle);

  // Búsqueda: filtrar mientras se escribe
  $('np-search').addEventListener('input', e => _renderList(e.target.value.trim()));

  // Desde el search, flecha abajo → primer ítem de la lista
  $('np-search').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      $('np-list').querySelector('.np-item')?.focus();
    }
  });

  // Navegación de teclado dentro de la lista
  $('np-list').addEventListener('keydown', _onListKey);

  // Esc → cerrar y devolver foco al trigger
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _isOpen) { _close(); $('np-trigger').focus(); }
  });

  // Click fuera → cerrar
  document.addEventListener('click', e => {
    if (_isOpen && !$('num-picker').contains(e.target)) _close();
  });
}

// ── API pública ───────────────────────────────────────────────────

/** Modo creación: trigger activo, valor vacío. */
export function resetPicker() {
  $('np-trigger').disabled = false;
  $('num-picker').classList.remove('np-readonly');
  _setLabel('— Elegir número —');
  $('f-num').value    = '';
  $('f-num').readOnly = false;
  _close();
}

/** Modo edición: trigger deshabilitado, muestra el número existente. */
export function setPickerValue(num) {
  $('np-trigger').disabled = true;
  $('num-picker').classList.add('np-readonly');
  _setLabel(`#${num}`);
  $('f-num').value    = num;
  $('f-num').readOnly = true;
}

// ── Internos ──────────────────────────────────────────────────────

function _toggle() {
  _isOpen ? _close() : _open();
}

function _open() {
  $('np-search').value = '';
  _renderList('');
  $('np-dropdown').hidden = false;
  $('np-trigger').setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => $('np-search').focus());
  _isOpen = true;
}

function _close() {
  if (!_isOpen) return;
  $('np-dropdown').hidden = true;
  $('np-trigger').setAttribute('aria-expanded', 'false');
  _isOpen = false;
}

function _select(num) {
  $('f-num').value = num;
  _setLabel(`#${num}`);
  _close();
  $('np-trigger').focus();
  // Dispara change para que validación en tiempo real pueda reaccionar
  $('f-num').dispatchEvent(new Event('change', { bubbles: true }));
}

function _setLabel(text) {
  $('np-trigger').querySelector('.np-label').textContent = text;
}

// Deriva la lista de disponibles del store en tiempo real
function _disponibles(q) {
  const ocupados = new Set(
    getBoletos()
      .filter(b => (b['Estado Boleto'] || 'Disponible') !== 'Disponible')
      .map(b => Number(b['No. Boleto']))
  );
  const all = Array.from({ length: TOTAL }, (_, i) => i + 1)
    .filter(n => !ocupados.has(n));
  return q ? all.filter(n => String(n).includes(q)) : all;
}

function _renderList(q) {
  const list    = $('np-list');
  const countEl = $('np-count');
  const nums    = _disponibles(q);

  list.innerHTML = '';

  if (countEl) {
    countEl.textContent = nums.length
      ? `${nums.length} disponible${nums.length !== 1 ? 's' : ''}`
      : '';
  }

  if (!nums.length) {
    const p = document.createElement('p');
    p.className   = 'np-empty';
    p.textContent = q ? 'Sin coincidencias' : 'No hay boletos disponibles';
    list.appendChild(p);
    return;
  }

  const frag = document.createDocumentFragment();
  nums.forEach(n => {
    const btn       = document.createElement('button');
    btn.type        = 'button';
    btn.className   = 'np-item';
    btn.textContent = n;
    btn.dataset.num = n;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-label', `Boleto ${n}`);
    btn.addEventListener('click', () => _select(n));
    frag.appendChild(btn);
  });
  list.appendChild(frag);
}

function _onListKey(e) {
  const items = [...$('np-list').querySelectorAll('.np-item')];
  const idx   = items.indexOf(document.activeElement);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    items[Math.min(idx + 1, items.length - 1)]?.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (idx <= 0) $('np-search').focus();
    else items[idx - 1].focus();
  } else if (e.key === 'Enter' && idx >= 0) {
    e.preventDefault();
    _select(Number(items[idx].dataset.num));
  }
}
