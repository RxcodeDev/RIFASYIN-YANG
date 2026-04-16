import { DEFAULT_ACTIONS } from './defaults.js';
import { SheetTransport }  from './transport.js';

/**
 * GoogleSheetsClient
 * High-level API client for a Google Sheets Apps Script backend.
 * Delegates HTTP to SheetTransport; focuses only on sheet operations.
 */
export class GoogleSheetsClient {
  #transport;
  #actions;

  /**
   * @param {object} config
   * @param {string} config.apiUrl
   *   Google Apps Script Web App exec URL.
   * @param {number} [config.timeout=10000]
   *   Fetch timeout in milliseconds.
   * @param {Partial<typeof DEFAULT_ACTIONS>} [config.actions]
   *   Override one or more action names sent to the Apps Script backend.
   *   Defaults: { getAll: 'getAll', add: 'agregar', update: 'actualizar' }
   *
   * @example
   *   // Default (matches the bundled Apps Script template)
   *   new GoogleSheetsClient({ apiUrl: '...' });
   *
   *   // Custom action names for a different backend
   *   new GoogleSheetsClient({
   *     apiUrl: '...',
   *     actions: { getAll: 'list', add: 'create', update: 'patch' },
   *   });
   */
  constructor({ apiUrl, timeout = 10_000, actions = {} } = {}) {
    if (!apiUrl || typeof apiUrl !== 'string') {
      throw new Error('GoogleSheetsClient: apiUrl is required.');
    }
    this.#transport = new SheetTransport(apiUrl, timeout);
    this.#actions   = { ...DEFAULT_ACTIONS, ...actions };
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Fetch every row from the sheet.
   * @returns {Promise<object[]>}
   */
  async getAll() {
    const { data } = await this.#transport.get({ accion: this.#actions.getAll });
    return data;
  }

  /**
   * Append a new row to the sheet.
   * @param {object} datos - Key/value map matching the sheet's column headers.
   * @returns {Promise<object>} Apps Script response.
   */
  async add(datos) {
    return this.#transport.post({ accion: this.#actions.add, datos });
  }

  /**
   * Update a single cell in an existing row.
   * @param {string|number} numero  - Row identifier (primary key value).
   * @param {string}        columna - Column header name.
   * @param {*}             valor   - New cell value.
   * @returns {Promise<object>}
   */
  async update(numero, columna, valor) {
    return this.#transport.post({ accion: this.#actions.update, numero, columna, valor });
  }

  /**
   * Upload a file (evidence of payment) for a given ticket number.
   * Sends base64-encoded content to the Apps Script backend.
   * The backend is expected to save the file in Google Drive and store the URL.
   *
   * @param {number} numero   - Ticket number (primary key).
   * @param {string} base64   - Base64-encoded file content (no data URI prefix).
   * @param {string} mimeType - MIME type, e.g. 'image/jpeg', 'application/pdf'.
   * @param {string} nombre   - Original filename.
   * @returns {Promise<object>}
   */
  async uploadFile(numero, base64, mimeType, nombre) {
    return this.#transport.post({
      accion:   this.#actions.uploadFile,
      numero,
      base64,
      mimeType,
      nombre,
    });
  }

  /**
   * Update multiple columns of an existing row.
   * Sends only changed columns (diff against `original`), in parallel.
   *
   * @param {string|number} numero     - Row identifier.
   * @param {object}        changes    - { columnName: newValue, ... }
   * @param {object}        [original={}] - Current row values for diffing.
   *                                        Omit to force-update every key.
   * @returns {Promise<void>}
   */
  async updateRecord(numero, changes, original = {}) {
    const pending = Object.entries(changes).filter(
      ([col, val]) => String(val ?? '') !== String(original[col] ?? '')
    );

    if (pending.length === 0) return;

    const results = await Promise.allSettled(
      pending.map(([columna, valor]) => this.update(numero, columna, valor))
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) {
      throw new Error(failed.map(f => f.reason.message).join('; '));
    }
  }
}
