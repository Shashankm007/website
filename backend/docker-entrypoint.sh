#!/bin/sh
set -e

# Apply pending migrations against the live DB, then hand off to the CMD.
echo "▶ Running prisma migrate deploy..."
npx prisma migrate deploy

# Optionally seed on first boot when SEED_ON_START=true (idempotent upserts).
if [ "$SEED_ON_START" = "true" ]; then
  echo "▶ Seeding database..."
  node dist/prisma/seed.js || true
fi

echo "▶ Starting backend..."
exec "$@"
