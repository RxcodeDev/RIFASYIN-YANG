import { SOLD }        from '../config.js';
import { getSelected } from './tickets.js';
import { sheets }      from '../panel/api.js';

/**
 * initBuyModal
 * Inicializa el modal de compra directa con transferencia bancaria.
 *
 * @param {object} ticket  - Sección ticket de site.json
 *   { bbvaClabe, bbvaCuenta, bbvaHolder, ticketPrice, mpLink, waButtonLabel... }
 */
export function initBuyModal(ticket) {
  const backdrop   = document.getElementById('buyBackdrop');
  const btnOpen    = document.getElementById('buy-btn');
  const btnClose   = document.getElementById('buyClose');
  const form       = document.getElementById('buyForm');
  const errorEl    = document.getElementById('buyError');
  const successEl  = document.getElementById('buySuccess');
  const nameInput  = document.getElementById('buyName');
  const phoneInput = document.getElementById('buyPhone');
  const ticketInput= document.getElementById('buyTicket');
  const fileInput  = document.getElementById('buyCaptura');
  const fileLabel  = document.getElementById('buyCapturaName');
  const mpBtn      = document.getElementById('mpBtn');

  if (!backdrop) return;

  // ── Poblar datos BBVA desde config ──────────────────────────────
  const cuenta  = ticket.bbvaCuenta  ?? '';
  const holder  = ticket.bbvaHolder  ?? '';

  const cuentaEl = document.getElementById('bbvaCuenta');
  const holderEl = document.getElementById('bbvaHolder');
  if (cuentaEl) cuentaEl.textContent = cuenta;
  if (holderEl) holderEl.textContent = holder;

  // ── Enlace Mercado Pago ──────────────────────────────────────────
  if (mpBtn && ticket.mpLink) mpBtn.href = ticket.mpLink;

  // ── Copiar al portapapeles ───────────────────────────────────────
  document.querySelectorAll('.bbva-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.copy;
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;
      // Texto sin espacios de formato para que se copie la cadena limpia
      const rawMap = { bbvaCuenta: cuenta, bbvaHolder: holder };
      const raw = rawMap[targetId] ?? targetEl.textContent.trim();
      _copyText(raw, btn);
    });
  });

  // ── Abrir / Cerrar ───────────────────────────────────────────────
  function open() {
    backdrop.hidden = false;
    _clearFeedback();
    form.reset();
    fileLabel.textContent = 'Toca para subir captura o PDF';

    // Pre-rellenar número de boleto si hay uno seleccionado
    const sel = getSelected();
    if (sel) ticketInput.value = sel;

    requestAnimationFrame(() => nameInput.focus());
  }

  function close() {
    backdrop.hidden = true;
  }

  btnOpen.addEventListener('click', open);
  btnClose.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !backdrop.hidden) close();
  });

  // ── Previsualizar nombre del archivo ────────────────────────────
  fileInput.addEventListener('change', () => {
    fileLabel.textContent = fileInput.files[0]
      ? fileInput.files[0].name
      : 'Toca para subir captura o PDF';
  });

  // ── Envío del formulario ─────────────────────────────────────────
  form.addEventListener('submit', async e => {
    e.preventDefault();
    _clearFeedback();

    // ── Validación ─────────────────────────────────────────────────
    const nombre   = nameInput.value.trim();
    const telefono = phoneInput.value.replace(/\D/g, '');
    const boleto   = parseInt(ticketInput.value, 10);
    const archivo  = fileInput.files[0];

    if (!nombre) {
      _showErr('Ingresa tu nombre completo.');
      nameInput.focus();
      return;
    }
    if (telefono.length !== 10) {
      _showErr('El teléfono debe tener 10 dígitos.');
      phoneInput.focus();
      return;
    }
    if (!boleto || boleto < 1 || boleto > 1100) {
      _showErr('Ingresa un número de boleto válido (1 – 1100).');
      ticketInput.focus();
      return;
    }
    if (SOLD.has(boleto)) {
      _showErr(`El boleto #${String(boleto).padStart(3,'0')} ya está apartado o vendido. Elige otro número.`);
      ticketInput.focus();
      return;
    }
    if (!archivo) {
      _showErr('Sube la captura o screenshot del comprobante de transferencia.');
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      _showErr('El archivo es muy grande. Máximo 5 MB.');
      return;
    }

    // ── Envío ──────────────────────────────────────────────────────
    const submitBtn = document.getElementById('buySubmit');
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Enviando…';

    try {
      const now = new Date().toISOString();

      // 1. Actualizar fila del boleto en el sheet
      await sheets.updateRecord(boleto, {
        'Nombre del Comprador': nombre,
        'Teléfono':             telefono,
        'Estado Boleto':        'Apartado',
        'Estado Pago':          'No pagado',
        'Método de Pago':       'Transfer',
        'Fecha de Venta':       now,
        'AB1 ':                 price,   // NOTE: columna con espacio al final (ver domain-model)
        'Restante ':            0,       // NOTE: ídem
      });

      // 2. Subir comprobante
      const base64 = await _fileToBase64(archivo);
      await sheets.uploadFile(boleto, base64, archivo.type, archivo.name);

      _showSuccess(
        `✓ ¡Listo! Tu comprobante del boleto #${String(boleto).padStart(3,'0')} fue enviado.\n` +
        'La verificación es manual y se actualiza en máx. 24 hrs.'
      );

      // Resetear formulario pero mantener modal abierto para que lean el mensaje
      form.reset();
      fileLabel.textContent = 'Toca para subir captura o PDF';
    } catch {
      _showErr('Ocurrió un error al enviar. Inténtalo de nuevo o envíanos tu comprobante por WhatsApp.');
    } finally {
      submitBtn.disabled    = false;
      submitBtn.innerHTML   = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg> Registrar pago';
    }
  });

  // ── Helpers ──────────────────────────────────────────────────────
  function _showErr(msg) {
    errorEl.textContent = msg;
    errorEl.hidden      = false;
    successEl.hidden    = true;
  }

  function _showSuccess(msg) {
    successEl.textContent = msg;
    successEl.hidden      = false;
    errorEl.hidden        = true;
  }

  function _clearFeedback() {
    errorEl.hidden   = true;
    successEl.hidden = true;
  }
}

// ── Utilidades de módulo ─────────────────────────────────────────────

/** Formatea una CLABE de 18 dígitos en grupos de 3-3-3-3-3-3 para legibilidad. */
function _fmtClabe(raw) {
  const digits = String(raw).replace(/\D/g, '');
  return digits.match(/.{1,3}/g)?.join(' ') ?? raw;
}

function _copyText(text, btn) {
  const original = btn.textContent;
  const done = () => {
    btn.textContent = '¡Copiado!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 2000);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(_fallbackCopy.bind(null, text, done));
  } else {
    _fallbackCopy(text, done);
  }
}

function _fallbackCopy(text, callback) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:absolute;left:-9999px;top:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); callback(); } catch { /* silencioso */ }
  document.body.removeChild(ta);
}

function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
