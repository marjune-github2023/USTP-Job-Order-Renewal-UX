#!/bin/sh
set -e

echo "🌱 Running database seed..."
cd /app/lib/db
DATABASE_URL="$DATABASE_URL" /app/node_modules/.bin/tsx src/seed.ts

echo "✅ Seed completed. Starting API server..."
cd /app
exec node --enable-source-maps ./artifacts/api-server/dist/index.mjs