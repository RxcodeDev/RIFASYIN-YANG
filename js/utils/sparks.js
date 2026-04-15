/**
 * Genera 40 partículas decorativas (chispas) dentro del contenedor #sparks.
 * Cada partícula recibe tamaño, posición y duración de animación aleatorios
 * vía CSS custom properties (--d, --delay), definidas en animations.css.
 */
export function initSparks() {
  const container = document.getElementById('sparks');

  for (let i = 0; i < 40; i++) {
    const spark = document.createElement('div');
    spark.className = 'spark';

    const size = (Math.random() * 4 + 2).toFixed(1);
    spark.style.cssText = [
      `width:${size}px`,
      `height:${size}px`,
      `left:${(Math.random() * 100).toFixed(2)}%`,
      `bottom:${(Math.random() * 20).toFixed(2)}%`,
      `--d:${(Math.random() * 4 + 3).toFixed(2)}s`,
      `--delay:${(Math.random() * 5).toFixed(2)}s`,
    ].join(';');

    container.appendChild(spark);
  }
}
