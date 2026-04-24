#!/bin/sh
set -e

DOMAIN="rifasyingyang.rxcode.com.mx"
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

# Si el certificado real aún no existe (primer arranque antes de correr certbot),
# genera uno self-signed temporal para que nginx pueda iniciar sin errores.
# Certbot reemplazará estos archivos al ejecutar el comando de obtención inicial.
if [ ! -f "${CERT_PATH}" ]; then
  echo "[entrypoint] Certificado SSL no encontrado — generando self-signed temporal..."
  mkdir -p "/etc/letsencrypt/live/${DOMAIN}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" \
    -out    "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" \
    -subj   "/CN=${DOMAIN}" 2>/dev/null
  echo "[entrypoint] Cert temporal OK. Ejecuta certbot para obtener el certificado real."
fi

exec "$@"
