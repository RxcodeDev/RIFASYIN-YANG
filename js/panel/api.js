/**
 * js/panel/api.js
 * Thin wrapper sobre GoogleSheetsClient con la URL del script hardcodeada.
 * Único lugar donde vive la URL — cambiarla aquí afecta todo el panel.
 */
import { GoogleSheetsClient } from '../lib/google-sheets/index.js';

const API_URL = 'https://script.google.com/macros/s/AKfycbyx71G7Qs-DG7R9kvwzx5H1lVJaf4vEgoutuQwqJeqMz5SQCLRb_7F-YwrJeuseqYbo/exec';

export const sheets = new GoogleSheetsClient({ apiUrl: API_URL });
