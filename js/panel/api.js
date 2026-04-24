/**
 * js/panel/api.js
 * Gestión de entornos (pruebas / prod) y cliente Google Sheets.
 * Único lugar donde viven las URLs — cambiarlas aquí afecta todo el panel.
 *
 * Estrategia de entorno:
 *  - En el dominio de producción → siempre 'prod', sin excepción.
 *    Ningún localStorage ni parámetro puede cambiarlo: garantiza que
 *    TODOS los usuarios (panel y página pública) lean el mismo sheet real.
 *  - En localhost / cualquier otro host → localStorage con fallback 'pruebas',
 *    permitiendo al dev cambiar de entorno desde el panel.
 */
import { GoogleSheetsClient } from '../lib/google-sheets/index.js';

export const ENVS = {
  pruebas: 'https://script.google.com/macros/s/AKfycbyx71G7Qs-DG7R9kvwzx5H1lVJaf4vEgoutuQwqJeqMz5SQCLRb_7F-YwrJeuseqYbo/exec',
  prod:    'https://script.google.com/macros/s/AKfycbw66pDi2rFEZ2J0anPGfbZTWYb8kqv8KD7P_Vk2CI4tIxBhjq16NaxbWaV6dGkYqx_CUg/exec',
};

const PROD_HOST = 'rifasyingyang.rxcode.com.mx';
const ENV_KEY   = 'panel_env';

// En producción el entorno es fijo; en dev lo controla localStorage.
const IS_PROD_HOST = window.location.hostname === PROD_HOST;

let _envName = IS_PROD_HOST
  ? 'prod'
  : (localStorage.getItem(ENV_KEY) ?? 'pruebas');

let _client = new GoogleSheetsClient({ apiUrl: ENVS[_envName] });

/** Retorna el nombre del entorno activo ('pruebas' | 'prod'). */
export function getEnv() { return _envName; }

/**
 * Cambia el entorno activo y persiste la elección.
 * En el dominio de producción esta función es no-op: el entorno no se puede
 * cambiar para evitar que cualquier usuario altere los datos que ve toda la app.
 */
export function setEnv(name) {
  if (IS_PROD_HOST) return; // Bloqueado en producción — entorno siempre 'prod'
  if (!ENVS[name]) throw new Error(`Entorno desconocido: ${name}`);
  _envName = name;
  localStorage.setItem(ENV_KEY, name);
  _client  = new GoogleSheetsClient({ apiUrl: ENVS[name] });
}

/** Proxy transparente — todos los módulos siguen usando sheets.xxx() sin cambios. */
export const sheets = {
  getAll:       (...a) => _client.getAll(...a),
  add:          (...a) => _client.add(...a),
  update:       (...a) => _client.update(...a),
  updateRecord: (...a) => _client.updateRecord(...a),
  uploadFile:   (...a) => _client.uploadFile(...a),
};

