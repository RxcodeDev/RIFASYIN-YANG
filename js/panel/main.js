/**
 * js/panel/main.js
 * Bootstrap: carga datos, enlaza eventos. Sin lógica de negocio aquí.
 */
import { sheets }          from './api.js';
import { setBoletos, getBoletos, setFiltro } from './store.js';
import {
  renderStats, renderFiltroVendedor, renderTabla, showLoader,
  abrirModalNuevo, abrirModalEditar, cerrarModal,
  getDatosForm, toast,
} from './ui.js';

// ── Carga de datos ────────────────────────────────────────────────
async function cargar() {
  showLoader();
  try {
    const rows = await sheets.getAll();
    setBoletos(rows);
    renderStats();
    renderFiltroVendedor();
    renderTabla();
  } catch (e) {
    toast('Error al cargar: ' + e.message, true);
  }
}

// ── Guardar (nuevo o edición) ─────────────────────────────────────
async function guardar() {
  const datos    = getDatosForm();
  const numInput = document.getElementById('f-num');
  const esEdicion = numInput.readOnly;

  try {
    document.getElementById('btn-guardar').disabled = true;
    if (esEdicion) {
      const original = getBoletos().find(b => b['No. Boleto'] == datos['No. Boleto']);
      await sheets.updateRecord(datos['No. Boleto'], datos, original);
      toast('Boleto actualizado ✓');
    } else {
      await sheets.add(datos);
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
}

// ── Init ──────────────────────────────────────────────────────────
bindEventos();
cargar();
