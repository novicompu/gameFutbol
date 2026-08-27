FROM node:20-alpine

WORKDIR /usr/src/app/game-backend

# Instalar dependencias primero para aprovechar la cache de capas
COPY game-backend/package*.json ./
RUN npm ci --omit=dev

# Codigo de la aplicacion
COPY game-backend/ ./

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "server.js"]
