/**
 * SheetTransport
 * Handles all HTTP communication with a Google Apps Script Web App.
 * Keeps fetch / AbortSignal logic isolated so the client stays clean.
 */
export class SheetTransport {
  #apiUrl;
  #timeout;

  /**
   * @param {string} apiUrl  - Apps Script exec URL.
   * @param {number} timeout - Request timeout in ms.
   */
  constructor(apiUrl, timeout) {
    this.#apiUrl  = apiUrl;
    this.#timeout = timeout;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  #signal() {
    return AbortSignal.timeout(this.#timeout);
  }

  async #parseResponse(res) {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? 'Apps Script returned ok=false');
    return json;
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  /**
   * Perform a GET request with query params.
   * @param {Record<string, string>} params
   * @returns {Promise<object>}
   */
  async get(params) {
    const url = `${this.#apiUrl}?${new URLSearchParams(params)}`;
    const res = await fetch(url, { signal: this.#signal() });
    return this.#parseResponse(res);
  }

  /**
   * Perform a POST request with a JSON body.
   * NOTE: Content-Type is intentionally omitted — Apps Script CORS breaks
   * when it is set explicitly.
   * @param {object} body
   * @returns {Promise<object>}
   */
  async post(body) {
    const res = await fetch(this.#apiUrl, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: this.#signal(),
    });
    return this.#parseResponse(res);
  }
}
