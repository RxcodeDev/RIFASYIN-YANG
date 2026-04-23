FROM node:22-alpine

WORKDIR /app

# Solo copia el servidor — sin package.json (cero dependencias externas)
COPY server.js .

# El directorio de uploads se monta como volumen en tiempo de ejecución
ENV UPLOAD_DIR=/data/uploads

EXPOSE 3000

CMD ["node", "server.js"]
