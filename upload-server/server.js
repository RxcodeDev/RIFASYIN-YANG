/**
 * upload-server/server.js
 * Servidor minimal de subida de archivos — sin dependencias externas.
 * Acepta POST /api/upload con JSON { numero, base64, mimeType, nombre }
 * Guarda el archivo decodificado en UPLOAD_DIR y responde { ok, url }.
 */
'use strict';

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const PORT        = 3000;
const UPLOAD_DIR  = process.env.UPLOAD_DIR ?? '/data/uploads';
const MAX_BYTES   = 5 * 1024 * 1024; // 5 MB (igual que el check del frontend)

// Tipos MIME permitidos y su extensión
const ALLOWED = {
  'image/jpeg':      '.jpg',
  'image/png':       '.png',
  'image/webp':      '.webp',
  'image/gif':       '.gif',
  'application/pdf': '.pdf',
};

// Crea el directorio de uploads si no existe
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Utilidades ─────────────────────────────────────────────────────────────

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type':   'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

// ── Servidor ───────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // ── GET /api/uploads — lista archivos subidos ──────────────────
  if (req.method === 'GET' && req.url === '/api/uploads') {
    fs.readdir(UPLOAD_DIR, (err, files) => {
      if (err) {
        console.error('[upload] Error listando directorio:', err);
        return json(res, 500, { ok: false, error: 'Error al leer directorio' });
      }

      const items = files
        .filter(f => /\.(jpg|png|webp|gif|pdf)$/i.test(f))
        .map(nombre => {
          const filePath = path.join(UPLOAD_DIR, nombre);
          let stat, fecha = null;
          try { stat = fs.statSync(filePath); fecha = stat.mtime.toISOString(); } catch { /* si falla, sin fecha */ }
          // nombre: "{boleto}-{uuid}.{ext}" → extraer número de boleto
          const boleto = parseInt(nombre.split('-')[0], 10) || null;
          const ext    = path.extname(nombre).slice(1).toLowerCase();
          return { nombre, url: `/uploads/${nombre}`, boleto, ext, bytes: stat?.size ?? 0, fecha };
        })
        // más recientes primero
        .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));

      return json(res, 200, { ok: true, data: items });
    });
    return;
  }

  // ── DELETE /api/uploads/:filename — eliminar archivo ─────────
  const deleteMatch = req.method === 'DELETE' && /^\/api\/uploads\/([^/]+)$/.exec(req.url);
  if (deleteMatch) {
    const filename = decodeURIComponent(deleteMatch[1]);
    // Solo nombres seguros: alfanumérico, guiones, punto + extensión permitida
    if (!/^[\w-]+\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(filename)) {
      return json(res, 400, { ok: false, error: 'Nombre de archivo inválido' });
    }
    const filePath = path.join(UPLOAD_DIR, filename);
    // Doble verificación: el path resuelto debe estar dentro de UPLOAD_DIR
    if (!filePath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
      return json(res, 400, { ok: false, error: 'Ruta no permitida' });
    }
    fs.unlink(filePath, err => {
      if (err && err.code === 'ENOENT') return json(res, 404, { ok: false, error: 'Archivo no encontrado' });
      if (err) { console.error('[upload] Error al borrar:', err); return json(res, 500, { ok: false, error: 'Error al borrar archivo' }); }
      console.info(`[upload] Borrado: ${filename}`);
      json(res, 200, { ok: true });
    });
    return;
  }

  // Solo acepta POST /api/upload
  if (req.method !== 'POST' || req.url !== '/api/upload') {
    return json(res, 404, { ok: false, error: 'Not found' });
  }

  const chunks  = [];
  let received  = 0;
  let aborted   = false;

  req.on('data', chunk => {
    if (aborted) return;
    received += chunk.length;

    // Rechaza payloads demasiado grandes antes de parsear
    if (received > MAX_BYTES + 2048) {
      aborted = true;
      json(res, 413, { ok: false, error: 'Payload too large' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (aborted) return;

    // ── Parse JSON ──────────────────────────────────────────────
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return json(res, 400, { ok: false, error: 'Invalid JSON' });
    }

    const { numero, base64, mimeType, nombre } = body;

    // ── Validaciones ────────────────────────────────────────────
    if (!numero || !base64 || !mimeType) {
      return json(res, 400, { ok: false, error: 'Faltan campos requeridos: numero, base64, mimeType' });
    }

    const ext = ALLOWED[mimeType];
    if (!ext) {
      return json(res, 415, { ok: false, error: `Tipo no permitido: ${mimeType}` });
    }

    // Decodifica base64 y verifica tamaño real
    let buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      return json(res, 400, { ok: false, error: 'base64 inválido' });
    }

    if (buffer.length > MAX_BYTES) {
      return json(res, 413, { ok: false, error: 'Archivo mayor a 5 MB' });
    }

    // Nombre seguro: {numero}-{uuid}.{ext}  — previene path traversal
    const safeName = `${Number(numero)}-${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeName);

    // ── Escritura ───────────────────────────────────────────────
    fs.writeFile(filePath, buffer, err => {
      if (err) {
        console.error('[upload] Error al escribir:', err);
        return json(res, 500, { ok: false, error: 'Error al guardar el archivo' });
      }
      console.info(`[upload] Guardado: ${safeName} (${buffer.length} bytes)`);
      json(res, 200, { ok: true, url: `/uploads/${safeName}` });
    });
  });

  req.on('error', err => {
    console.error('[upload] Error de request:', err);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.info(`[upload] Servidor escuchando en :${PORT}`);
  console.info(`[upload] Directorio: ${UPLOAD_DIR}`);
});
