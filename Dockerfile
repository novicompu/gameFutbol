
# Usar la imagen base de Node.js
FROM node:14-alpine

# Instalar dependencias adicionales necesarias para nginx, bash, cron, etc.
RUN apk update 

# Configurar archivos de nginx y supervisord
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

# Crear y establecer el directorio de trabajo
WORKDIR /usr/src/app

# Copiar los archivos de la aplicación
COPY ./game-backend .

# Instalar las dependencias de Node.js
RUN npm install --production

# Establecer permisos
RUN chown -R node:node /usr/src/app


# Exponer el puerto que usará la aplicación
EXPOSE 3000

# Definir el punto de entrada y el comando por defecto
ENTRYPOINT ["entrypoint.sh"]
