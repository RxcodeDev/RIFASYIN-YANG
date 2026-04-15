// ── Configuración global ──────────────────────────────────────────
// Edita SOLO este archivo para actualizar los datos de la rifa.

/** Cantidad total de boletos disponibles en el sorteo. */
export const TOTAL = 1100;

/** Número de WhatsApp destino principal, con código de país y sin "+". */
export const WA_NUM = '523348179129';

/**
 * Boletos ya vendidos/apartados.
 * Agrega o quita números según las ventas confirmadas.
 * @type {Set<number>}
 */
export const SOLD = new Set([
  5, 12, 33, 47, 88, 100, 123, 200, 250, 300,
  333, 400, 444, 500, 555, 600, 666, 700, 750, 777,
  800, 850, 900, 950, 999, 1000, 1050, 1080, 1090, 1100,
]);
