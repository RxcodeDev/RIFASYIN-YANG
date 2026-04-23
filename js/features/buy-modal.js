import { SOLD }        from '../config.js';
import { getSelected } from './tickets.js';
import { sheets }      from '../panel/api.js';

/**
 * initBuyModal
 * Inicializa el modal de compra directa con transferencia bancaria.
 *
 * @param {object}   ticket    - Sección ticket de site.json
 *   { bbvaClabe, bbvaCuenta, bbvaHolder, ticketPrice, mpLink, waButtonLabel... }
 * @param {function} getRows   - Getter que retorna el array en vivo de todos los boletos (_allRows).
 *   Se recibe como función para evitar capturar el valor vacío del bootstrap asíncrono.
 */
export function initBuyModal(ticket, getRows = () => []) {
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
      // ── Derivados de cliente ──────────────────────────────────
      const rows        = getRows();
      const clienteId   = _nextClientId(rows);
      const repetido    = _isRepetido(rows, telefono);

      // 1. Actualizar fila del boleto en el sheet (best-effort, máx 3s — no bloquea el upload)
      // NOTE: Fecha de Venta NO se escribe — el sheet tiene la fórmula
      //   =SI(B<n><>"";HOY();"") que produce un valor fecha nativo cuando se
      //   escribe Nombre del Comprador. Escribir un string aquí destruye la
      //   fórmula y provoca #VALUE! en Fecha Límite Apartado (=H<n>+1).
      // NOTE: Fecha Límite Apartado tampoco se escribe — depende de Fecha de Venta.
      try {
        const _sheetTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000));
        await Promise.race([
          sheets.updateRecord(boleto, {
            'Nombre del Comprador':  nombre,
            'Teléfono':              telefono,
            'Estado Boleto':         'Pagado',
            'Estado Pago':           'Pagado',
            'Vendedor':              'Web',
            'Promotor':              'Web',
            'Método de Pago':        'Transfer',
            'Estado Apartado':       'Activo',
            'ID Cliente':            clienteId,
            'Cliente Repetido':      repetido ? '⚠️ Repetido' : '',
            'AB1 ':                  ticket.ticketPrice,
            'Restante ':             0,
          }),
          _sheetTimeout,
        ]);
      } catch (sheetErr) {
        console.warn('[buy-modal] Sheet update falló, continúa con upload:', sheetErr.message);
      }

      // 2. Subir comprobante al servidor local
      const base64   = await _fileToBase64(archivo);
      const uploadRes = await fetch('/api/upload', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ numero: boleto, base64, mimeType: archivo.type, nombre: archivo.name }),
      });
      if (!uploadRes.ok) throw new Error(`HTTP ${uploadRes.status}`);

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

/** Formatea Date como YYYY-MM-DD (sin hora) — compatible con Google Sheets. */
function _fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Genera el siguiente ID cliente (CL-XXXX) basándose en los datos en memoria. */
function _nextClientId(rows) {
  const nums = rows
    .map(r => r['ID Cliente'])
    .filter(id => /^CL-\d{4}$/.test(id))
    .map(id => parseInt(id.slice(3), 10));
  const max = nums.length ? Math.max(...nums) : 0;
  return `CL-${String(max + 1).padStart(4, '0')}`;
}

/** Devuelve true si el teléfono ya existe en otro boleto (cliente repetido). */
function _isRepetido(rows, telefono) {
  const norm = String(telefono).replace(/\D/g, '').slice(-10);
  return rows.some(r => String(r['Teléfono'] ?? '').replace(/\D/g, '').slice(-10) === norm);
}
