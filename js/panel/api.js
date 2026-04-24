/**
 * js/panel/api.js
 * Gestión de entornos (pruebas / prod) y cliente Google Sheets.
 * Único lugar donde viven las URLs — cambiarlas aquí afecta todo el panel.
 *
 * El entorno activo se almacena en el servidor (/api/env) para que sea
 * compartido entre TODOS los usuarios y navegadores.
 * El panel lo cambia vía POST /api/env; la página pública lo lee al arrancar.
 * Así, un cambio en el panel se refleja en tiempo real en toda la app.
 */
import { GoogleSheetsClient } from '../lib/google-sheets/index.js';

export const ENVS = {
  pruebas: 'https://script.google.com/macros/s/AKfycbyx71G7Qs-DG7R9kvwzx5H1lVJaf4vEgoutuQwqJeqMz5SQCLRb_7F-YwrJeuseqYbo/exec',
  prod:    'https://script.google.com/macros/s/AKfycbw66pDi2rFEZ2J0anPGfbZTWYb8kqv8KD7P_Vk2CI4tIxBhjq16NaxbWaV6dGkYqx_CUg/exec',
};

let _envName = 'prod'; // valor inicial seguro mientras llega la respuesta del servidor
let _client  = new GoogleSheetsClient({ apiUrl: ENVS[_envName] });

/** Retorna el nombre del entorno activo ('pruebas' | 'prod'). */
export function getEnv() { return _envName; }

/**
 * Cambia el entorno activo en el servidor y actualiza el cliente local.
 * Todos los usuarios que recarguen verán el nuevo entorno.
 */
export async function setEnv(name) {
  if (!ENVS[name]) throw new Error(`Entorno desconocido: ${name}`);
  const res = await fetch('/api/env', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ env: name }),
  });
  if (!res.ok) throw new Error(`Error al cambiar entorno: HTTP ${res.status}`);
  _envName = name;
  _client  = new GoogleSheetsClient({ apiUrl: ENVS[name] });
}

/**
 * Inicializa el entorno leyéndolo desde el servidor.
 * Debe llamarse una vez al arrancar (bootstrap de main.js y panel/main.js).
 */
export async function initEnv() {
  try {
    const res  = await fetch('/api/env');
    const data = await res.json();
    if (data.ok && ENVS[data.env]) {
      _envName = data.env;
      _client  = new GoogleSheetsClient({ apiUrl: ENVS[data.env] });
    }
  } catch {
    // Si el servidor no responde (dev sin Docker) queda en 'prod' como fallback seguro
    console.warn('[api] No se pudo leer /api/env — usando entorno por defecto: prod');
  }
}

/** Proxy transparente — todos los módulos siguen usando sheets.xxx() sin cambios. */
export const sheets = {
  getAll:       (...a) => _client.getAll(...a),
  add:          (...a) => _client.add(...a),
  update:       (...a) => _client.update(...a),
  updateRecord: (...a) => _client.updateRecord(...a),
  uploadFile:   (...a) => _client.uploadFile(...a),
};

