import { TOTAL, WA_NUM, SOLD } from '../config.js';
import { playTick, playWin, playSelect, playError } from '../utils/sounds.js';

// ── Estado del módulo ─────────────────────────────────────────────
let selected  = null;  // número actualmente elegido (null = ninguno)
let mode      = 'r';   // 'r' aleatorio | 'm' manual
let curFilter = 'all'; // 'all' | 'av' | 'tk'
let spinning  = false; // guard para genRand: evita intervalos concurrentes

/** Devuelve el número de boleto actualmente seleccionado (null si ninguno). */
export function getSelected() { return selected; }

// ── Stats ─────────────────────────────────────────────────────────
export function updateStats() {
  const sold  = document.getElementById('sn-sold');
  const avail = document.getElementById('sn-avail');
  if (sold)  sold.textContent  = SOLD.size;
  if (avail) avail.textContent = TOTAL - SOLD.size;
}

// ── Cambio de modo (aleatorio ↔ manual) ───────────────────────────
export function setMode(m) {
  mode = m;

  document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === m);
  });

  document.getElementById('panel-r').classList.toggle('show', m === 'r');
  document.getElementById('panel-m').classList.toggle('show', m === 'm');

  selected = null;
  _updateWA();
}

// ── Número aleatorio ──────────────────────────────────────────────
export function genRand() {
  if (spinning) return; // previene intervalos concurrentes por doble-click
  spinning = true;

  const el    = document.getElementById('rnum');
  let   count = 0;

  const iv = setInterval(() => {
    el.textContent = String(Math.floor(Math.random() * TOTAL) + 1).padStart(3, '0');
    el.classList.add('spin');
    // progress 0→1 para que el tick decelere (sonido de ruleta frenando)
    playTick(count / 22);
    count++;

    if (count > 22) {
      clearInterval(iv);
      spinning = false;

      const avail = Array.from({ length: TOTAL }, (_, i) => i + 1).filter(n => !SOLD.has(n));

      if (!avail.length) {
        el.textContent = 'AGOTADO';
        el.classList.remove('spin');
        return;
      }

      const picked = avail[Math.floor(Math.random() * avail.length)];
      el.textContent = String(picked).padStart(3, '0');
      el.classList.remove('spin');

      playWin();
      selected = picked;
      _updateWA();
      _highlightGrid(picked);
    }
  }, 65);
}

// ── Verificación de número manual ────────────────────────────────
export function checkT(v, suppressPulse = false) {
  const n      = parseInt(v, 10);
  const status = document.getElementById('t-status');

  if (!v || isNaN(n) || n < 1 || n > TOTAL) {
    status.textContent = '';
    status.className   = '';
    selected           = null;
    _updateWA();
    return;
  }

  if (SOLD.has(n)) {
    status.textContent = '✗ Número ya vendido — elige otro';
    status.className   = 'no';
    selected           = null;
    playError();
  } else {
    status.textContent = '✓ ¡Disponible! Apártalo ahora';
    status.className   = 'ok';
    selected           = n;
    playSelect();
    if (!suppressPulse) setTimeout(_pulseWA, 300);
  }

  _updateWA();
}

// ── Grid de boletos ───────────────────────────────────────────────
export function renderGrid(filter = 'all', search = '') {
  const grid = document.getElementById('tgrid');
  grid.innerHTML = '';
  let shown = 0;

  for (let i = 1; i <= TOTAL; i++) {
    const isSold = SOLD.has(i);
    const isSel  = selected === i;
    const ns     = String(i).padStart(3, '0');

    if (filter === 'av' && isSold)      continue;
    if (filter === 'tk' && !isSold)     continue;
    if (search && !ns.includes(search)) continue;

    const cell = document.createElement('div');
    cell.className   = 'tnum' + (isSold ? ' tk' : '') + (isSel ? ' sl' : '');
    cell.textContent = ns;
    cell.dataset.n   = i;

    if (!isSold) cell.addEventListener('click', () => _pickGrid(i));

    grid.appendChild(cell);
    shown++;
  }

  const gcnt = document.getElementById('gcnt');
  if (gcnt) gcnt.textContent =
    `Mostrando ${shown} · ${TOTAL - SOLD.size} disponibles de ${TOTAL}`;
}

// ── Filtros del grid ──────────────────────────────────────────────
export function filterBy(filter) {
  curFilter = filter;

  document.querySelectorAll('.f-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.filter === filter);
  });

  renderGrid(filter, document.getElementById('sinput').value);
}

export function filterG(value) {
  renderGrid(curFilter, value || '');
}

// ── Privadas ──────────────────────────────────────────────────────

function _updateWA() {
  const btn    = document.getElementById('wa-btn');
  const buyBtn = document.getElementById('buy-btn');

  if (selected) {
    const msg = encodeURIComponent(
      `¡Hola! Quiero apartar el boleto *${String(selected).padStart(3, '0')}* de la Rifa Suzuki Swift 2026. ¿Está disponible? 🚗🔥`
    );
    btn.href = `https://wa.me/${WA_NUM}?text=${msg}`;
    btn.classList.add('wa-ready');
    if (buyBtn) buyBtn.classList.add('buy-ready');
  } else {
    btn.href = `https://wa.me/${WA_NUM}`;
    btn.classList.remove('wa-ready', 'wa-cta');
    btn.style.animation = '';
    if (buyBtn) buyBtn.classList.remove('buy-ready');
  }
}

function _pulseWA() {
  const btn    = document.getElementById('wa-btn');
  const buyBtn = document.getElementById('buy-btn');
  if (!btn) return;
  btn.classList.remove('wa-cta');
  void btn.offsetWidth;                   // fuerza reflow para reiniciar animación
  btn.classList.add('wa-cta');
  // waShake: 0.4s × 2 = 0.8s | waGlow: delay 0.8s + 1.4s × 3 = 5s total
  setTimeout(() => btn.classList.remove('wa-cta'), 5100);

  if (buyBtn) {
    buyBtn.classList.remove('buy-cta');
    void buyBtn.offsetWidth;
    buyBtn.classList.add('buy-cta');
    setTimeout(() => buyBtn.classList.remove('buy-cta'), 5100);
  }
}

function _pickGrid(n) {
  selected = n;
  setMode('m');

  const input = document.getElementById('minput');
  input.value = n;
  checkT(String(n), true);  // suppressPulse: _pickGrid maneja su propio timing

  // Render primero — estabiliza el DOM antes de hacer scroll.
  // Si se llama después, el reflow de 1100 celdas desplaza el destino.
  renderGrid(curFilter, document.getElementById('sinput').value);

  document.getElementById('comprar').scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Tras el scroll, llamar la atención sobre el botón de apartar
  setTimeout(_pulseWA, 600);
}

function _highlightGrid(n) {
  renderGrid(curFilter, document.getElementById('sinput').value);

  const el = document.querySelector(`.tnum[data-n="${n}"]`);
  if (!el) return;

  // 1. Scroll a la sección del grid
  document.getElementById('disponibles')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 2. Scroll interno del grid: centrar el boleto
  const grid = el.closest('.tgrid');
  if (grid) {
    const top = el.offsetTop - grid.clientHeight / 2.3 + el.offsetHeight / 2;
    grid.scrollTo({ top, behavior: 'smooth' });
  }

  // 3. Tras mostrar el boleto, regresar a #comprar y pulsar WA
  setTimeout(() => {
    document.getElementById('comprar')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(_pulseWA, 1200);  // esperar que el scroll termine
  }, 1800);
}
