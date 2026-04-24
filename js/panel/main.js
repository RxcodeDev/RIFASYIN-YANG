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

// ── Guardar (nuevo o edición) ─────────────────────────────────────
async function guardar() {
  const datos    = getDatosForm();
  const numInput = document.getElementById('f-num');
  const esEdicion = numInput.readOnly;

  if (!validateForm(esEdicion)) return; // detener si hay errores

  try {
    document.getElementById('btn-guardar').disabled = true;
    if (esEdicion) {
      const original = getBoletos().find(b => b['No. Boleto'] == datos['No. Boleto']);
      await sheets.updateRecord(datos['No. Boleto'], datos, original);
      toast('Boleto actualizado ✓');
    } else {
      // El sheet tiene las 1100 filas precargadas como "Disponible".
      // "Agregar" = actualizar esa fila existente, nunca appendRow.
      const original = getBoletos().find(b => b['No. Boleto'] == datos['No. Boleto']);
      await sheets.updateRecord(datos['No. Boleto'], datos, original ?? {});
      toast('Boleto agregado ✓');
    }
    cerrarModal();
    await cargar();
  } catch (e) {
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
