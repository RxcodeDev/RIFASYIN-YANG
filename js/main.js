import { initSparks }                                      from './utils/sparks.js';
import { renderNav, renderHero, renderPrizes,
         renderTicketSection, renderSocial,
         renderFooter, renderPageMeta }                    from './utils/renderer.js';
import { updateStats, setMode, genRand, checkT,
         renderGrid, filterBy, filterG }                   from './features/tickets.js';

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

  // ── Partículas decorativas ─────────────────────────────────────
  initSparks();

  // ── Lógica de boletos ──────────────────────────────────────────
  updateStats();
  renderGrid();

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
}

document.addEventListener('DOMContentLoaded', bootstrap);
