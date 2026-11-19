# syntax=docker/dockerfile:1
#
# CVeditör: statik site + Hono sunucusu + Chromium (tek tuşla PDF). Ayrıntı: docs/YAYIN.md
#
#   docker compose build          (ya da: docker build -t cveditor .)
#   docker compose up -d
#
# Chromium sürümü package-lock.json'daki playwright-core sürümünden gelir (aynı sürüm e2e
# testlerinde de kullanılır: testlerde geçen PDF canlıdakiyle aynı motordan çıkar).

ARG NODE_IMAGE=node:24-bookworm-slim

# ---------------------------------------------------------------- 1. Derleme
FROM ${NODE_IMAGE} AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# İstemci derlemesine gömülür (gizli değil): "http" → gerçek yapay zekâ uçları, boş → örnek sağlayıcı.
ARG VITE_AI_PROVIDER=
ENV VITE_AI_PROVIDER=${VITE_AI_PROVIDER}
# İstemci (dist/) + sunucu (dist-server/)
RUN npm run build

# ---------------------------------------------------------------- 2. Çalışma
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PORT=8787 \
    HOST=0.0.0.0
WORKDIR /app

COPY package.json package-lock.json ./
# Yalnız üretim bağımlılıkları; Chromium (başsız kabuk) ve sistem kütüphaneleri playwright-core'un
# kendi kurulum komutuyla, aynı sürümle.
RUN npm ci --omit=dev --no-audit --no-fund \
 && npx --no-install playwright-core install --with-deps --only-shell chromium \
 && npm cache clean --force \
 && rm -rf /var/lib/apt/lists/* /root/.cache

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

# Root olmayan kullanıcı (node imajındaki "node", uid 1000)
USER node

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "--enable-source-maps", "dist-server/index.js"]
