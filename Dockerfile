# The workspace lockfile currently includes Linux x64 native build packages.
FROM node:24.14.1-trixie-slim AS build
WORKDIR /build
RUN npm install --global pnpm@10.34.5
COPY . .
RUN pnpm install --frozen-lockfile
RUN PORT=8080 BASE_PATH=/ NODE_ENV=production pnpm run build
RUN pnpm --filter @workspace/api-server exec esbuild \
    ../../lib/db/scripts/create-hrmo.mjs --bundle --platform=node --format=esm \
    --external:pg-native --outfile=dist/create-hrmo.mjs \
    '--banner:js=import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'

FROM node:24.14.1-trixie-slim AS runtime
RUN apt-get update \
    && apt-get install --yes --no-install-recommends python3 python3-venv ca-certificates \
    && python3 -m venv /opt/pdf \
    && /opt/pdf/bin/pip install --no-cache-dir pymupdf==1.28.2 \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORTAL_DIST_DIR=/app/ui PDF_PYTHON=/opt/pdf/bin/python \
    BACKUP_DIRECTORY=/var/lib/ustp/backups PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY --from=build --chown=node:node /build/artifacts/api-server/dist ./api
COPY --from=build --chown=node:node /build/artifacts/mockup-sandbox/dist ./ui
COPY --from=build --chown=node:node /build/artifacts/mockup-sandbox/public ./ui/public
COPY deploy/entrypoint.sh /usr/local/bin/portal-entrypoint
RUN chmod 755 /usr/local/bin/portal-entrypoint \
    && mkdir -p /var/lib/ustp/backups \
    && chown node:node /var/lib/ustp/backups
USER node
EXPOSE 8080
# Health check uses the PORT environment variable (set by Render or defaults to 8080)
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD node -e 'const port=process.env.PORT||8080;fetch("http://127.0.0.1:"+port+"/api/healthz").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
ENTRYPOINT ["portal-entrypoint"]
CMD ["node", "--enable-source-maps", "/app/api/index.mjs"]
