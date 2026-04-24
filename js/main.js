import { initSparks }                                      from './utils/sparks.js';
import { renderNav, renderHero, renderPrizes,
         renderTicketSection, renderSocial,
         renderFooter, renderPageMeta }                    from './utils/renderer.js';
import { updateStats, setMode, genRand, checkT,
         renderGrid, filterBy, filterG }                   from './features/tickets.js';
import { SOLD, setSold }                                    from './config.js';
import { unlockAudio }                                     from './utils/sounds.js';
import { sheets, initEnv }                                 from './panel/api.js';
import { initBuyModal }                                    from './features/buy-modal.js';

// Cache de todas las filas del sheet — se usa en el modal de verificación
let _allRows = [];

async function bootstrap() {
  // ── Leer entorno activo desde el servidor (pruebas | prod) ────
  // Debe ser lo primero: garantiza que sheets use el URL correcto.
  await initEnv();

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
    _allRows = rows;
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

  // ── Modal Comprar Directo ──────────────────────────────────────
  // Se pasa getter en lugar del array directo: _allRows se llena async después del bootstrap.
  initBuyModal(data.ticket, () => _allRows);
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
  const backdrop       = document.getElementById('statusBackdrop');
  const btnOpen        = document.getElementById('btnMiBoleto');
  const btnClose       = document.getElementById('statusClose');
  const formView       = document.getElementById('status-form');
  const detailView     = document.getElementById('status-detail');
  const inputNum       = document.getElementById('statusInput');
  const inputPhone     = document.getElementById('statusPhone');
  const errorEl        = document.getElementById('statusError');
  const btnSubmit      = document.getElementById('statusSubmit');
  const btnBack        = document.getElementById('statusBack');
  const detailNum      = document.getElementById('detailNum');
  const detailBadge    = document.getElementById('detailBadge');
  const detailAbonos   = document.getElementById('detailAbonos');
  const detailUpload   = document.getElementById('detailUpload');
  const fileInput      = document.getElementById('evidenciaInput');
  const uploadFileName = document.getElementById('uploadFileName');
  const uploadSendBtn  = document.getElementById('uploadSendBtn');
  const uploadFeedback = document.getElementById('uploadFeedback');
  if (!backdrop) return;

  let _currentNum = null;

  // ── Helpers ─────────────────────────────────────────────────────
  function showErr(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function clearErr() {
    errorEl.textContent = '';
    errorEl.hidden = true;
  }

  function normalizePhone(p) {
    return String(p ?? '').replace(/\D/g, '').slice(-10);
  }

  // ── Open / close ─────────────────────────────────────────────────
  function open() {
    backdrop.hidden = false;
    resetForm();
    requestAnimationFrame(() => inputNum.focus());
  }

  function close() {
    backdrop.hidden = true;
  }

  function resetForm() {
    formView.hidden   = false;
    detailView.hidden = true;
    inputNum.value    = '';
    inputPhone.value  = '';
    clearErr();
    _currentNum = null;
  }

  // ── Query ────────────────────────────────────────────────────────
  function check() {
    clearErr();
    const n = parseInt(inputNum.value, 10);

    if (!n || n < 1 || n > 1100) {
      showErr('Ingresa un número de boleto del 1 al 1100.');
      return;
    }

    if (!_allRows.length) {
      showErr('Los datos están cargando. Espera un momento e intenta de nuevo.');
      return;
    }

    const row = _allRows.find(r => parseInt(r['No. Boleto'], 10) === n);
    if (!row) {
      showErr('Boleto no encontrado. Verifica el número.');
      return;
    }

    const estado = (row['Estado Boleto'] ?? 'Disponible').trim();

    if (estado === 'Disponible') {
      _currentNum = n;
      showDetail(row);
      return;
    }

    const phone = inputPhone.value.trim();
    if (!phone) {
      showErr('Ingresa tu número de teléfono para verificar tu identidad.');
      return;
    }

    const rowPhone  = normalizePhone(row['Teléfono']);
    const inputNorm = normalizePhone(phone);
    if (!rowPhone || rowPhone !== inputNorm) {
      showErr('El teléfono no coincide con el registrado para este boleto.');
      return;
    }

    _currentNum = n;
    showDetail(row);
  }

  // ── Render detail ─────────────────────────────────────────────────
  function showDetail(row) {
    formView.hidden   = true;
    detailView.hidden = false;

    const n      = parseInt(row['No. Boleto'], 10);
    const num    = String(n).padStart(3, '0');
    const estado = (row['Estado Boleto'] ?? 'Disponible').trim();

    detailNum.textContent = `Boleto #${num}`;

    detailBadge.textContent = estado;
    detailBadge.className   = 'status-badge';
    const badgeMap = { Disponible: 'badge-libre', Apartado: 'badge-apartado', Pagado: 'badge-pagado' };
    detailBadge.classList.add(badgeMap[estado] ?? 'badge-libre');

    if (estado === 'Disponible') {
      detailAbonos.innerHTML = '<p class="tl-available-msg">Este boleto está disponible. ¡Apártalo ahora!</p>';
    } else {
      detailAbonos.innerHTML = buildTimeline(row, estado);
    }
    detailUpload.hidden = true;
  }

  function buildTimeline(row, estado) {
    // NOTE: AB1 tiene espacio al final en el sheet — se prueba ambas variantes
    const AB_KEYS = ['AB1 ', 'AB2', 'AB3', 'AB4', 'AB5', 'AB6', 'AB7', 'AB8', 'AB9', 'AB10', 'AB11', 'AB12'];
    const PRECIO  = 550;

    const abonos = AB_KEYS
      .map((k, i) => ({ num: i + 1, amount: parseFloat(row[k] ?? row[k.trim()] ?? 0) || 0 }))
      .filter(a => a.amount > 0);

    const totalPagado = abonos.reduce((s, a) => s + a.amount, 0);
    // NOTE: 'Restante ' tiene espacio al final en el sheet
    const restante    = parseFloat(row['Restante '] ?? row['Restante'] ?? (PRECIO - totalPagado)) || (PRECIO - totalPagado);

    const iconCheck  = `<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
    const iconCircle = `<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>`;
    const iconStar   = `<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;

    let html = '<div class="tl-wrap">';

    if (abonos.length === 0) {
      html += `
      <div class="tl-step pending">
        <div class="tl-dot">${iconCircle}</div>
        <div class="tl-content">
          <span class="tl-label">Sin abonos registrados aún</span>
          <span class="tl-amount">$${PRECIO.toLocaleString('es-MX')}</span>
        </div>
      </div>`;
    } else {
      abonos.forEach(ab => {
        html += `
      <div class="tl-step done">
        <div class="tl-dot">${iconCheck}</div>
        <div class="tl-content">
          <span class="tl-label">Abono ${ab.num}</span>
          <span class="tl-amount">$${ab.amount.toLocaleString('es-MX')}</span>
        </div>
      </div>`;
      });

      if (estado === 'Pagado') {
        html += `
      <div class="tl-step final">
        <div class="tl-dot">${iconStar}</div>
        <div class="tl-content">
          <span class="tl-label">¡Pagado completo!</span>
          <span class="tl-amount">$${PRECIO.toLocaleString('es-MX')}</span>
        </div>
      </div>`;
      } else {
        html += `
      <div class="tl-step pending">
        <div class="tl-dot">${iconCircle}</div>
        <div class="tl-content">
          <span class="tl-label">Pendiente por pagar</span>
          <span class="tl-amount">$${restante.toLocaleString('es-MX')}</span>
        </div>
      </div>`;
      }
    }

    html += `
    <div class="tl-summary">
      <div class="tl-sum-row"><span>Total pagado</span><span class="tl-sum-val">$${totalPagado.toLocaleString('es-MX')}</span></div>
      ${estado !== 'Pagado' ? `<div class="tl-sum-row restante"><span>Falta</span><span class="tl-sum-val red">$${restante.toLocaleString('es-MX')}</span></div>` : ''}
    </div>
    </div>`;

    return html;
  }

  // ── File upload ───────────────────────────────────────────────────
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    uploadFileName.textContent = file.name;
    uploadSendBtn.hidden       = false;
    uploadFeedback.textContent = '';
    uploadFeedback.className   = 'upload-feedback';
  });

  uploadSendBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file || _currentNum === null) return;

    if (file.size > 5 * 1024 * 1024) {
      uploadFeedback.className   = 'upload-feedback error';
      uploadFeedback.textContent = 'El archivo es muy grande. Máximo 5 MB.';
      return;
    }

    uploadSendBtn.disabled    = true;
    uploadSendBtn.textContent = 'Enviando…';
    uploadFeedback.textContent = '';

    try {
      const base64 = await fileToBase64(file);
      const res    = await fetch('/api/upload', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ numero: _currentNum, base64, mimeType: file.type, nombre: file.name }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      uploadFeedback.className   = 'upload-feedback success';
      uploadFeedback.textContent = '¡Comprobante enviado! Se verificará en máx. 24 hrs.';
      uploadSendBtn.hidden = true;
    } catch {
      uploadFeedback.className   = 'upload-feedback error';
      uploadFeedback.textContent = 'Error al enviar. Inténtalo de nuevo o envíalo por WhatsApp.';
      uploadSendBtn.disabled    = false;
      uploadSendBtn.textContent = 'Reintentar';
    }
  });

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // ── Events ────────────────────────────────────────────────────────
  btnSubmit.addEventListener('click', check);
  btnBack.addEventListener('click',   resetForm);
  btnOpen.addEventListener('click',   open);
  btnClose.addEventListener('click',  close);
  backdrop.addEventListener('click',  e => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  inputNum.addEventListener('keydown',   e => { if (e.key === 'Enter') check(); });
  inputPhone.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
}

document.addEventListener('DOMContentLoaded', bootstrap);
