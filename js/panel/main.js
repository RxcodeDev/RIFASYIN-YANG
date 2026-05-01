/**
 * js/panel/main.js
 * Bootstrap: carga datos, enlaza eventos. Sin lógica de negocio aquí.
 */
import { sheets, getEnv, setEnv, initEnv }  from './api.js';
import { setBoletos, getBoletos, setFiltro } from './store.js';
import {
  renderStats, renderFiltroVendedor, renderTabla, showLoader,
  abrirModalNuevo, abrirModalEditar, cerrarModal,
  getDatosForm, toast, renderDashboard, validateForm,
} from './ui.js';
import { initComprobantes, cargarComprobantes } from './comprobantes.js';

// ── Carga de datos ────────────────────────────────────────────────
async function cargar() {
  showLoader();
  try {
    const rows = await sheets.getAll();
    setBoletos(rows);
    renderStats();
    renderFiltroVendedor();
    renderTabla();
    renderDashboard();
  } catch (e) {
    toast('Error al cargar: ' + e.message, true);
  }
}

// ── Modal de confirmación (liberar boleto) ────────────────────────
function mostrarConfirm() {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm-overlay');
    overlay.classList.add('active');

    const ok     = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancelar');

    function cleanup(result) {
      overlay.classList.remove('active');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk()     { cleanup(true);  }
    function onCancel() { cleanup(false); }

    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); }, { once: true });
  });
}

// ── Liberar boleto (reset a Disponible) ──────────────────────────
const RESET_BOLETO = {
  'Nombre del Comprador':  '',
  'Teléfono':              '',
  'Estado Boleto':         'Disponible',
  'Estado Pago':           'No pagado',
  'Vendedor':              '',
  'Promotor':              '',
  'Fecha de Venta':        '',
  'Método de Pago':        '',
  'Fecha Límite Apartado': '',
  'Estado Apartado':       '',
  'ID Cliente':            '',
  'Cliente Repetido':      '',
  'Restante ':             '550',
  'AB1 ':                  '',
  'AB2': '', 'AB3': '', 'AB4': '', 'AB5': '', 'AB6':  '',
  'AB7': '', 'AB8': '', 'AB9': '', 'AB10': '', 'AB11': '', 'AB12': '',
};

async function liberarBoleto() {
  const num = document.getElementById('f-num').value;
  if (!num) return;

  const confirmado = await mostrarConfirm();
  if (!confirmado) return;

  const overlay = document.getElementById('modal-spinner-overlay');
  const msg     = document.getElementById('modal-spinner-msg');
  msg.textContent = `Liberando boleto #${num}…`;
  overlay.hidden  = false;

  try {
    const original = getBoletos().find(b => b['No. Boleto'] == num);
    await sheets.updateRecord(num, { ...RESET_BOLETO, 'No. Boleto': num }, original ?? {});
    overlay.hidden = true;
    cerrarModal();
    toast(`Boleto #${num} liberado ✓`);
    await cargar();
  } catch (e) {
    overlay.hidden = true;
    toast('Error al liberar: ' + e.message, true);
  }
}

// ── Guardar (nuevo o edición) ─────────────────────────────────────
async function guardar() {
  const datos    = getDatosForm();
  const numInput = document.getElementById('f-num');
  const esEdicion = numInput.readOnly;

  if (!validateForm(esEdicion)) return; // detener si hay errores

  const spinnerOverlay = document.getElementById('modal-spinner-overlay');
  const spinnerMsg     = document.getElementById('modal-spinner-msg');

  try {
    document.getElementById('btn-guardar').disabled = true;
    spinnerMsg.textContent = esEdicion
      ? `Guardando boleto #${datos['No. Boleto']}…`
      : `Creando boleto #${datos['No. Boleto']}…`;
    spinnerOverlay.hidden = false;

    if (esEdicion) {
      const original = getBoletos().find(b => b['No. Boleto'] == datos['No. Boleto']);
      // Fecha de Venta: escribir explícitamente si el boleto pasa a no-Disponible
      // y aún no tiene fecha. La fórmula del sheet (=SI(B<n><>"";HOY();"")) es
      // poco confiable cuando se escribe vía API — se setea aquí como YYYY-MM-DD.
      if (datos['Estado Boleto'] !== 'Disponible' && !original?.['Fecha de Venta']) {
        datos['Fecha de Venta'] = new Date().toISOString().split('T')[0];
      }
      await sheets.updateRecord(datos['No. Boleto'], datos, original);
      toast('Boleto actualizado ✓');
    } else {
      // El sheet tiene las 1100 filas precargadas como "Disponible".
      // "Agregar" = actualizar esa fila existente, nunca appendRow.
      const original = getBoletos().find(b => b['No. Boleto'] == datos['No. Boleto']);
      if (datos['Estado Boleto'] !== 'Disponible') {
        datos['Fecha de Venta'] = datos['Fecha de Venta'] || new Date().toISOString().split('T')[0];
      }
      await sheets.updateRecord(datos['No. Boleto'], datos, original ?? {});
      toast('Boleto agregado ✓');
    }
    spinnerOverlay.hidden = true;
    cerrarModal();
    await cargar();
  } catch (e) {
    spinnerOverlay.hidden = true;
    toast('Error: ' + e.message, true);
  } finally {
    document.getElementById('btn-guardar').disabled = false;
  }
}

// ── Eventos ───────────────────────────────────────────────────────
function bindEventos() {
  // Búsqueda y filtros → re-render inmediato (datos ya en memoria)
  document.getElementById('search').addEventListener('input', e => {
    setFiltro('busqueda', e.target.value);
    renderTabla();
  });
  document.getElementById('filter-estado').addEventListener('change', e => {
    setFiltro('estado', e.target.value);
    renderTabla();
  });
  document.getElementById('filter-vendedor').addEventListener('change', e => {
    setFiltro('vendedor', e.target.value);
    renderTabla();
  });

  document.getElementById('btn-nuevo').addEventListener('click', abrirModalNuevo);
  document.getElementById('btn-recargar').addEventListener('click', cargar);
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('btn-guardar').addEventListener('click', guardar);
  document.getElementById('btn-liberar').addEventListener('click', liberarBoleto);

  // Selector de entorno (prod / pruebas)
  const envSelect = document.getElementById('env-select');
  const _syncEnvStyle = () => envSelect.dataset.env = getEnv();
  envSelect.value = getEnv();
  _syncEnvStyle();
  envSelect.addEventListener('change', async () => {
    setEnv(envSelect.value);
    _syncEnvStyle();
    await cargar();
  });

  // Cerrar modal al clickear el overlay
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) cerrarModal();
  });

  // Delegación en tbody: un solo listener para todos los botones de editar
  document.getElementById('tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-editar]');
    if (!btn) return;
    const boleto = getBoletos().find(b => b['No. Boleto'] == btn.dataset.editar);
    if (boleto) abrirModalEditar(boleto);
  });

  // Delegación en cards-list: mismo comportamiento para la vista mobile
  document.getElementById('cards-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-editar]');
    if (!btn) return;
    const boleto = getBoletos().find(b => b['No. Boleto'] == btn.dataset.editar);
    if (boleto) abrirModalEditar(boleto);
  });

  // ── Tabs ────────────────────────────────────────────────────────
  const tabBoletos       = document.getElementById('tab-boletos');
  const tabComprobantes  = document.getElementById('tab-comprobantes');
  const viewBoletos      = document.getElementById('split-view');
  const viewComprobantes = document.getElementById('section-comprobantes');
  const toolbar          = document.querySelector('.toolbar');

  function activarTab(tab) {
    const esBoletos = tab === 'boletos';

    tabBoletos.classList.toggle('panel-tab--active', esBoletos);
    tabBoletos.setAttribute('aria-selected', String(esBoletos));
    tabComprobantes.classList.toggle('panel-tab--active', !esBoletos);
    tabComprobantes.setAttribute('aria-selected', String(!esBoletos));

    viewBoletos.hidden      = !esBoletos;
    viewComprobantes.hidden = esBoletos;
    // La toolbar solo tiene sentido en la vista de boletos
    toolbar.hidden = !esBoletos;

    if (!esBoletos) cargarComprobantes();
  }

  tabBoletos.addEventListener('click',      () => activarTab('boletos'));
  tabComprobantes.addEventListener('click', () => activarTab('comprobantes'));
}

// ── Init ──────────────────────────────────────────────────────────
// initEnv() debe ser lo primero: determina qué sheet lee sheets.getAll()
initEnv().then(() => {
  initComprobantes();
  bindEventos();
  cargar();
});
