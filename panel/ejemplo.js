import { GoogleSheetsClient } from './lib/google-sheets/index.js';

const sheets = new GoogleSheetsClient({
  apiUrl: 'https://script.google.com/macros/s/AKfycbyx71G7Qs-DG7R9kvwzx5H1lVJaf4vEgoutuQwqJeqMz5SQCLRb_7F-YwrJeuseqYbo/exec',
});

let todosLosBoletos = [];
let modoEdicion = false;
let numeroEdicion = null;

// ─── CARGAR ───────────────────────────────────────────────────────────────────
async function cargarBoletos() {
  document.getElementById('loader').style.display = 'flex';
  document.getElementById('tabla').style.display = 'none';
  document.getElementById('empty').style.display = 'none';

  try {
    todosLosBoletos = await sheets.getAll();
    llenarFiltroVendedor();
    renderTabla();
    actualizarStats();
  } catch (e) {
    toast('Error al cargar: ' + e.message, true);
    document.getElementById('loader').style.display = 'none';
  }
}

function actualizarStats() {
  const total      = todosLosBoletos.length;
  const pagado     = todosLosBoletos.filter(b => b['Estado Boleto'] === 'Pagado').length;
  const apartado   = todosLosBoletos.filter(b => b['Estado Boleto'] === 'Apartado').length;
  const disponible = todosLosBoletos.filter(b => b['Estado Boleto'] === 'Disponible').length;
  document.getElementById('stat-total').textContent     = total;
  document.getElementById('stat-pagado').textContent    = pagado;
  document.getElementById('stat-apartado').textContent  = apartado;
  document.getElementById('stat-disponible').textContent = disponible;
}

function llenarFiltroVendedor() {
  const vendedores = [...new Set(todosLosBoletos.map(b => b['Vendedor']).filter(Boolean))].sort();
  const sel = document.getElementById('filter-vendedor');
  sel.innerHTML = '<option value="">Todos los vendedores</option>';
  vendedores.forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    sel.appendChild(o);
  });
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function renderTabla() {
  const busqueda      = document.getElementById('search').value.toLowerCase();
  const filtroEstado  = document.getElementById('filter-estado').value;
  const filtroVendedor = document.getElementById('filter-vendedor').value;

  const filtrados = todosLosBoletos.filter(b => {
    const matchBusqueda = !busqueda ||
      String(b['No. Boleto']).includes(busqueda) ||
      (b['Nombre del Comprador'] || '').toLowerCase().includes(busqueda) ||
      (b['Teléfono'] || '').includes(busqueda);
    const matchEstado   = !filtroEstado   || b['Estado Boleto'] === filtroEstado;
    const matchVendedor = !filtroVendedor || b['Vendedor']       === filtroVendedor;
    return matchBusqueda && matchEstado && matchVendedor;
  });

  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  document.getElementById('loader').style.display = 'none';

  if (filtrados.length === 0) {
    document.getElementById('tabla').style.display = 'none';
    document.getElementById('empty').style.display = 'block';
    return;
  }

  document.getElementById('empty').style.display = 'none';
  document.getElementById('tabla').style.display  = 'table';

  filtrados.forEach(b => {
    const estado = b['Estado Boleto'] || 'Disponible';
    const badgeClass = estado === 'Pagado'   ? 'badge-pagado'
                     : estado === 'Apartado' ? 'badge-apartado'
                     : 'badge-disponible';
    const estadoPago = b['Estado Pago'] || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${b['No. Boleto']}</strong></td>
      <td>${b['Nombre del Comprador'] || '<span style="color:var(--muted)">—</span>'}</td>
      <td>${b['Teléfono'] || '—'}</td>
      <td><span class="badge ${badgeClass}">${estado}</span></td>
      <td>${estadoPago || '—'}</td>
      <td>${b['Vendedor'] || '—'}</td>
      <td>${b['Promotor'] || '—'}</td>
      <td>${b['Método de Pago'] || '—'}</td>
      <td style="color:${b['Restante'] > 0 ? 'var(--accent2)' : 'var(--muted)'}">
        ${b['Restante'] ? '$' + b['Restante'] : '—'}
      </td>
      <td>
        <button class="btn btn-secondary" style="font-size:0.7rem;padding:0.3rem 0.7rem"
          data-editar="${b['No. Boleto']}">Editar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function abrirModalNuevo() {
  modoEdicion = false;
  numeroEdicion = null;
  document.getElementById('modal-title').innerHTML = 'Nuevo <span style="color:var(--accent)">Boleto</span>';
  limpiarForm();
  document.getElementById('modal-overlay').classList.add('active');
}

function abrirModalEditar(numero) {
  const b = todosLosBoletos.find(x => x['No. Boleto'] == numero);
  if (!b) return;
  modoEdicion   = true;
  numeroEdicion = numero;
  document.getElementById('modal-title').innerHTML = `Editar boleto <span style="color:var(--accent)">#${numero}</span>`;
  document.getElementById('f-num').value            = b['No. Boleto']           || '';
  document.getElementById('f-nombre').value         = b['Nombre del Comprador'] || '';
  document.getElementById('f-tel').value            = b['Teléfono']             || '';
  document.getElementById('f-estado-boleto').value  = b['Estado Boleto']        || 'Disponible';
  document.getElementById('f-estado-pago').value    = b['Estado Pago']          || 'No pagado';
  document.getElementById('f-vendedor').value       = b['Vendedor']             || '';
  document.getElementById('f-promotor').value       = b['Promotor']             || '';
  document.getElementById('f-metodo').value         = b['Método de Pago']       || '';
  document.getElementById('f-restante').value       = b['Restante']             || '';
  document.getElementById('f-fecha-limite').value   = b['Fecha Limite Apartado']|| '';
  document.getElementById('f-estado-apartado').value = b['Estado Apartado']     || 'Activo';
  document.getElementById('f-id-cliente').value     = b['ID Cliente']           || '';
  document.getElementById('modal-overlay').classList.add('active');
}

function limpiarForm() {
  ['f-num','f-nombre','f-tel','f-vendedor','f-promotor','f-restante','f-fecha-limite','f-id-cliente']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-estado-boleto').value   = 'Disponible';
  document.getElementById('f-estado-pago').value     = 'No pagado';
  document.getElementById('f-metodo').value          = '';
  document.getElementById('f-estado-apartado').value = 'Activo';
}

function cerrarModal(e) {
  if (e.target === document.getElementById('modal-overlay')) cerrarModalDirecto();
}

function cerrarModalDirecto() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// ─── GUARDAR ──────────────────────────────────────────────────────────────────
async function guardarBoleto() {
  const datos = {
    'No. Boleto':           document.getElementById('f-num').value,
    'Nombre del Comprador': document.getElementById('f-nombre').value,
    'Teléfono':             document.getElementById('f-tel').value,
    'Estado Boleto':        document.getElementById('f-estado-boleto').value,
    'Estado Pago':          document.getElementById('f-estado-pago').value,
    'Vendedor':             document.getElementById('f-vendedor').value,
    'Promotor':             document.getElementById('f-promotor').value,
    'Método de Pago':       document.getElementById('f-metodo').value,
    'Restante':             document.getElementById('f-restante').value,
    'Fecha Limite Apartado':document.getElementById('f-fecha-limite').value,
    'Estado Apartado':      document.getElementById('f-estado-apartado').value,
    'ID Cliente':           document.getElementById('f-id-cliente').value,
  };

  try {
    if (modoEdicion) {
      const original = todosLosBoletos.find(b => b['No. Boleto'] == numeroEdicion);
      await sheets.updateRecord(numeroEdicion, datos, original);
      toast('Boleto actualizado ✓');
    } else {
      await sheets.add(datos);
      toast('Boleto agregado ✓');
    }
    cerrarModalDirecto();
    await cargarBoletos();
  } catch (e) {
    toast('Error: ' + e.message, true);
  }
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function toast(msg, error = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (error ? ' error' : '');
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ─── EVENTOS ──────────────────────────────────────────────────────────────────
document.getElementById('search').addEventListener('input', renderTabla);
document.getElementById('filter-estado').addEventListener('change', renderTabla);
document.getElementById('filter-vendedor').addEventListener('change', renderTabla);

document.getElementById('btn-nuevo').addEventListener('click', abrirModalNuevo);
document.getElementById('btn-recargar').addEventListener('click', cargarBoletos);
document.getElementById('btn-cancelar').addEventListener('click', cerrarModalDirecto);
document.getElementById('btn-guardar').addEventListener('click', guardarBoleto);
document.getElementById('modal-overlay').addEventListener('click', cerrarModal);

// Delegación en tbody para botones de editar (se registra una sola vez)
document.getElementById('tbody').addEventListener('click', e => {
  const btn = e.target.closest('[data-editar]');
  if (btn) abrirModalEditar(btn.dataset.editar);
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
cargarBoletos();
