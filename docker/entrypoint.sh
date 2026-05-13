#!/bin/sh
set -eu

./node_modules/.bin/prisma migrate deploy

if [ "${RUN_SEED:-false}" = "true" ]; then
  ./node_modules/.bin/tsx prisma/seed.ts
fi

exec "$@"
