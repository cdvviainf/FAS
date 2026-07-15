# Stage 1: compilar TypeScript y generar cliente Prisma
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
# DATABASE_URL dummy solo para que prisma generate valide el schema (no conecta a DB)
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: imagen de producción mínima
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
# Copiamos el cliente Prisma generado en el builder (sin re-generar)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
EXPOSE 3001
# DATABASE_URL real viene de las variables de entorno de Coolify en runtime
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
