# Stage 1: compilar TypeScript y generar cliente Prisma
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
# NODE_ENV=development para que npm instale devDependencies (typescript, tsx, etc.)
# --ignore-scripts evita que @prisma/client postinstall dispare prisma generate sin schema
RUN NODE_ENV=development npm ci --ignore-scripts
COPY prisma ./prisma
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: imagen de producción mínima
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
# Chromium del sistema para el motor de documentos (Playwright, Etapa 4):
# el binario que Playwright intenta descargar por su cuenta es glibc y no
# corre en Alpine (musl) — se usa el paquete de Alpine en su lugar, apuntado
# vía PLAYWRIGHT_EXECUTABLE_PATH (config/env.ts). --ignore-scripts más abajo
# ya evita que el postinstall de Playwright intente esa descarga igual.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont
ENV PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium-browser
COPY package*.json ./
# --ignore-scripts evita el postinstall de @prisma/client; el cliente ya viene copiado del builder
RUN npm ci --omit=dev --ignore-scripts
COPY prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
