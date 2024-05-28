
# Usar la imagen base de Node.js
FROM node:20-alpine

# Instalar dependencias adicionales necesarias para nginx, bash, cron, etc.
RUN apk update 


# Crear y establecer el directorio de trabajo
WORKDIR /usr/src/app

# Copiar los archivos de la aplicación
COPY . .

RUN cd /usr/src/app/game-backend \
    && npm install

CMD ["node", "/usr/src/app/game-backend/server.js"]
