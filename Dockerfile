# ---------------------------------------------------------------------------
# 1) Compilation : frontend React (Vite) + serveur local (esbuild)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV YARN_CACHE_FOLDER=/usr/local/share/.cache/yarn

# Manifestes d'abord : la couche d'installation est réutilisée tant que les
# dépendances ne changent pas.
COPY package.json yarn.lock ./
COPY apps/adcampaign-manager/package.json apps/adcampaign-manager/package.json
COPY packages/components/package.json packages/components/package.json

RUN yarn install --frozen-lockfile --network-timeout 600000

COPY . .

# Frontend → apps/adcampaign-manager/dist
# Serveur  → server/dist/server.mjs (bundle autonome, aucune dépendance externe)
RUN yarn build

# ---------------------------------------------------------------------------
# 2) Exécution : image minimale, sans node_modules
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

COPY --from=builder /app/server/dist/server.mjs ./server.mjs
COPY --from=builder /app/apps/adcampaign-manager/dist ./public

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 8080
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
