import { initSparks }                                      from './utils/sparks.js';
import { renderNav, renderHero, renderPrizes,
         renderTicketSection, renderSocial,
         renderFooter, renderPageMeta }                    from './utils/renderer.js';
import { updateStats, setMode, genRand, checkT,
         renderGrid, filterBy, filterG }                   from './features/tickets.js';
import { SOLD, setSold }                                    from './config.js';
import { unlockAudio }                                     from './utils/sounds.js';
import { sheets }                                          from './panel/api.js';

async function bootstrap() {
  // ── Cargar contenido desde JSON ────────────────────────────────
  const data = await fetch('data/site.json').then(r => r.json());

  renderPageMeta(data.site);
  renderNav(data.nav, data.site);
  renderHero(data.hero);
  renderPrizes(data.prizes);
  renderTicketSection(data.ticket);
  renderSocial(data.social);
  renderFooter(data.footer);

  // ── Desbloquear AudioContext en primer gesto (iOS/Android) ────
  // touchstart garantiza que estamos dentro de un gesto directo del usuario.
  // { once: true } lo elimina automáticamente después del primer toque.
  document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  document.addEventListener('click',      unlockAudio, { once: true });

  // ── Partículas decorativas ─────────────────────────────────────
  initSparks();

  // ── Lógica de boletos (datos hardcode mientras carga API) ─────────
  updateStats();
  renderGrid();

  // ── Sincronizar SOLD desde Google Sheets (no-bloqueante) ────────
  sheets.getAll().then(rows => {
    const liveSold = new Set(
      rows
        .filter(r => (r['Estado Boleto'] || '').trim() !== 'Disponible')
        .map(r => parseInt(r['No. Boleto'], 10))
        .filter(n => !isNaN(n))
    );
    setSold(liveSold);
    updateStats();
    renderGrid();
  }).catch(() => { /* API no disponible — se mantiene el fallback hardcodeado */ });

  // ── Tabs de modo (aleatorio / manual) ─────────────────────────
  document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  // ── Panel aleatorio ────────────────────────────────────────────
  document.getElementById('btn-genrand').addEventListener('click', genRand);

  // ── Panel manual ──────────────────────────────────────────────
  document.getElementById('minput').addEventListener('input', e => checkT(e.target.value));

  // ── Grid: búsqueda y filtros ───────────────────────────────────
  document.getElementById('sinput').addEventListener('input', e => filterG(e.target.value));

  document.querySelectorAll('.f-btn').forEach(btn => {
    btn.addEventListener('click', () => filterBy(btn.dataset.filter));
  });

  // ── Slider de galería ──────────────────────────────────────────
  initSlider();
  initVideoAutoplay();

  // ── Modal Mi Boleto ────────────────────────────────────────────
  initStatusModal();
}

function initSlider() {
  const track  = document.getElementById('sliderTrack');
  const prev   = document.getElementById('sliderPrev');
  const next   = document.getElementById('sliderNext');
  const dotsEl = document.getElementById('sliderDots');
  if (!track) return;

  const slides = track.querySelectorAll('.slide');
  const total  = slides.length;
  let current  = 0;
  let autoplay;

  // Crear dots
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Ir a imagen ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(dot);
  });

  function goTo(idx) {
    current = (idx + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;
    dotsEl.querySelectorAll('.slider-dot').forEach((d, i) =>
      d.classList.toggle('active', i === current)
    );
    resetAutoplay();
  }

  function resetAutoplay() {
    clearInterval(autoplay);
    autoplay = setInterval(() => goTo(current + 1), 4000);
  }

  prev.addEventListener('click', () => goTo(current - 1));
  next.addEventListener('click', () => goTo(current + 1));

  // Swipe táctil
  let startX = 0;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend',   e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) goTo(current + (diff > 0 ? 1 : -1));
  });

  resetAutoplay();
}

function initVideoAutoplay() {
  const video = document.getElementById('prizeVideo');
  if (!video) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { threshold: 0.3 }
  );

  observer.observe(video);
}

function initStatusModal() {
  const backdrop = document.getElementById('statusBackdrop');
  const btnOpen  = document.getElementById('btnMiBoleto');
  const btnClose = document.getElementById('statusClose');
  const input    = document.getElementById('statusInput');
  const result   = document.getElementById('statusResult');
  if (!backdrop) return;

  function open() {
    backdrop.hidden = false;
    input.value = '';
    result.className = 'status-result';
    result.textContent = '';
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    backdrop.hidden = true;
  }

  function check() {
    const n = parseInt(input.value, 10);
    result.className = 'status-result';
    result.textContent = '';

    if (!n || n < 1 || n > 1100) {
      result.className = 'status-result invalid';
      result.textContent = 'Ingresa un número del 1 al 1100';
      return;
    }

    const num = String(n).padStart(3, '0');
    if (SOLD.has(n)) {
      result.className = 'status-result vendido';
      result.innerHTML = `Boleto #${num} &mdash; Apartado / Vendido`;
    } else {
      result.className = 'status-result libre';
      result.innerHTML = `Boleto #${num} &mdash; Disponible`;
    }
  }

  btnOpen.addEventListener('click', open);
  btnClose.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  input.addEventListener('input', check);
}

document.addEventListener('DOMContentLoaded', bootstrap);
