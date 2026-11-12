# NEXUS CRM — pacote portátil (Render, VPS com Coolify, ou qualquer servidor com Docker).
# Montar:  docker build -t nexus-crm \
#            --build-arg NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co \
#            --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_... .
# Rodar:   docker run -p 3000:3000 --env-file .env nexus-crm
# Segredos (SUPABASE_SERVICE_ROLE_KEY etc.) entram SÓ na hora de rodar (--env-file), nunca no build.

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variáveis públicas: o Next.js as grava no código do navegador durante o build.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nexus
COPY --from=builder --chown=nexus:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nexus:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nexus:nodejs /app/public ./public
USER nexus
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
