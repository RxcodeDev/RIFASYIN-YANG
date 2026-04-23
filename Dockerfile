# ── Stage único: nginx sirve los archivos estáticos ───────────────────────────
FROM nginx:alpine

# Elimina la config por defecto
RUN rm /etc/nginx/conf.d/default.conf

# Copia la configuración personalizada
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copia los archivos estáticos al directorio web de nginx
COPY . /usr/share/nginx/html/

# Puerto de escucha
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
