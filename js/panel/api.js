/**
 * js/panel/api.js
 * Gestión de entornos (pruebas / prod) y cliente Google Sheets.
 * Único lugar donde viven las URLs — cambiarlas aquí afecta todo el panel.
 *
 * El entorno activo se persiste en localStorage bajo la clave 'panel_env'.
 * sheets es un proxy transparente: ningún consumidor necesita cambiar.
 */
import { GoogleSheetsClient } from '../lib/google-sheets/index.js';

export const ENVS = {
  pruebas: 'https://script.google.com/macros/s/AKfycbyx71G7Qs-DG7R9kvwzx5H1lVJaf4vEgoutuQwqJeqMz5SQCLRb_7F-YwrJeuseqYbo/exec',
  prod:    'https://script.google.com/macros/s/AKfycbw66pDi2rFEZ2J0anPGfbZTWYb8kqv8KD7P_Vk2CI4tIxBhjq16NaxbWaV6dGkYqx_CUg/exec',
};

const ENV_KEY = 'panel_env';

let _envName = localStorage.getItem(ENV_KEY) ?? 'prod';
let _client  = new GoogleSheetsClient({ apiUrl: ENVS[_envName] });

/** Retorna el nombre del entorno activo ('pruebas' | 'prod'). */
export function getEnv() { return _envName; }

/** Cambia el entorno activo y persiste la elección. */
export function setEnv(name) {
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

