/**
 * sounds.js — Efectos de audio generados con Web Audio API.
 * Sin archivos externos. El contexto se crea al primer gesto del usuario
 * (requisito de autoplay policy en todos los browsers modernos).
 *
 * Técnicas usadas:
 *  - Capas de osciladores (fundamental + armónicos) para timbre rico
 *  - ADSR completo en cada voz
 *  - Reverb sintético: delay corto con feedback (simula sala pequeña)
 *  - Detuning para efecto chorus/ensemble en el win
 */

let _ctx = null;

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

/**
 * Desbloquea el AudioContext en iOS/Android.
 * DEBE llamarse sincrónicamente dentro de un handler de touchstart o click.
 * iOS no permite crear ni resumir AudioContext fuera de un gesto directo del usuario.
 * Se registra una sola vez en document; después de desbloqueado se auto-elimina.
 */
export function unlockAudio() {
  if (_ctx) return; // ya desbloqueado
  const c = ctx();  // crea el contexto dentro del gesto
  // Reproduce un buffer silencioso: fuerza a iOS a marcar el contexto como "allowed"
  const buf = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
}

/** Crea un reverb sintético ligero con delay + feedback. */
function _reverb(c, wet = 0.3) {
  const delay    = c.createDelay(0.1);
  const feedback = c.createGain();
  const mix      = c.createGain();

  delay.delayTime.value  = 0.055;
  feedback.gain.value    = 0.38;
  mix.gain.value         = wet;

  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(mix);
  mix.connect(c.destination);

  return delay; // conectar la señal aquí para añadir reverb
}

/** Crea un oscilador con envolvente ADSR y lo conecta al destino dado. */
function _voice(c, dest, { type = 'sine', freq, detune = 0,
                            a = 0.01, d = 0.1, s = 0.4, r = 0.3,
                            peak = 0.3, start, dur }) {
  const osc  = c.createOscillator();
  const gain = c.createGain();

  osc.type                = type;
  osc.frequency.value     = freq;
  osc.detune.value        = detune;

  const t0 = start ?? c.currentTime;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + a);
  gain.gain.linearRampToValueAtTime(peak * s, t0 + a + d);
  gain.gain.setValueAtTime(peak * s, t0 + dur - r);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(gain);
  gain.connect(dest);

  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// ── Tick de ruleta ────────────────────────────────────────────────
// Notas de xilófono en escala mayor (Do mayor): cada tick sube un paso,
// dando sensación alegre de "subiendo" mientras gira la ruleta.
// progress 0→1 recorre la escala C4→C5 (8 notas cíclicas).
export function playTick(progress = 0) {
  const c   = ctx();
  const now = c.currentTime;

  // Escala mayor C4: Do Re Mi Fa Sol La Si Do (C4→C5)
  const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
  const idx   = Math.floor(progress * (scale.length - 1));
  const freq  = scale[idx];

  // Capa 1: ataque brillante tipo xilófono (triángulo)
  const osc1  = c.createOscillator();
  const g1    = c.createGain();
  osc1.type   = 'triangle';
  osc1.frequency.value = freq;
  g1.gain.setValueAtTime(0.25, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc1.connect(g1); g1.connect(c.destination);
  osc1.start(now); osc1.stop(now + 0.09);

  // Capa 2: armónico +octava (brillo dorado)
  const osc2  = c.createOscillator();
  const g2    = c.createGain();
  osc2.type   = 'sine';
  osc2.frequency.value = freq * 2;
  g2.gain.setValueAtTime(0.08, now);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc2.connect(g2); g2.connect(c.destination);
  osc2.start(now); osc2.stop(now + 0.08);
}

// ── Fanfarria ganadora ────────────────────────────────────────────
// Redoble ascendente rápido (Do→Mi→Sol→Do→Mi→Sol) + golpe de acorde
// final con reverb → claramente festivo / "¡ganaste!".
export function playWin() {
  const c   = ctx();
  const now = c.currentTime;
  const rev = _reverb(c, 0.4);

  // Redoble ascendente: 6 notas rápidas antes del acorde
  const run = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]; // C5→G6
  run.forEach((freq, i) => {
    _voice(c, rev, {
      type: 'triangle', freq,
      a: 0.005, d: 0.04, s: 0.3, r: 0.05,
      peak: 0.18 + i * 0.02,
      start: now + i * 0.07,
      dur: 0.12,
    });
  });

  // Acorde C mayor triunfal (C5+E5+G5+C6) — golpe fuerte
  const tChord = now + run.length * 0.07 + 0.02;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    _voice(c, rev, {
      type: 'sine', freq, detune: i * 4,
      a: 0.01, d: 0.06, s: 0.75, r: 0.55,
      peak: 0.26,
      start: tChord,
      dur: 1.1,
    });
    // Armónico brillante +8va
    _voice(c, rev, {
      type: 'triangle', freq: freq * 2, detune: -i * 3,
      a: 0.01, d: 0.05, s: 0.2, r: 0.3,
      peak: 0.08,
      start: tChord,
      dur: 0.7,
    });
  });

  // Shimmer final: tono muy agudo que brilla sobre el acorde
  _voice(c, rev, {
    type: 'sine', freq: 3135.96, // G7
    a: 0.02, d: 0.1, s: 0.3, r: 0.6,
    peak: 0.06,
    start: tChord + 0.05,
    dur: 0.9,
  });
}

// ── Moneda / selección disponible ────────────────────────────────
// Tono de moneda de casino: ataque rápido brillante + cola larga dorada.
export function playSelect() {
  const c   = ctx();
  const now = c.currentTime;
  const rev = _reverb(c, 0.25);

  // Fundamental: 1320 Hz (Mi6) — brillante como campanita
  _voice(c, rev, { type: 'sine',     freq: 1318.5, a: 0.005, d: 0.04, s: 0.5, r: 0.4, peak: 0.28, start: now, dur: 0.55 });
  // Armónico (+octava): da el "brillo dorado"
  _voice(c, rev, { type: 'triangle', freq: 2637,   a: 0.005, d: 0.03, s: 0.2, r: 0.3, peak: 0.12, start: now, dur: 0.4  });
  // Sub suave: cuerpo de la moneda
  _voice(c, rev, { type: 'sine',     freq: 440,    a: 0.01,  d: 0.08, s: 0.1, r: 0.2, peak: 0.10, start: now, dur: 0.3  });
}

// ── Error (número vendido) ────────────────────────────────────────
// Descenso suave — no harsh, pero claro: "no disponible".
export function playError() {
  const c   = ctx();
  const now = c.currentTime;

  const osc  = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(210, now + 0.22);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  osc.connect(gain);
  gain.connect(c.destination);

  osc.start(now);
  osc.stop(now + 0.3);
}
