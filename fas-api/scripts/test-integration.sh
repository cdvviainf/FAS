#!/usr/bin/env bash
set -euo pipefail

TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgresql://fas_user:fas_pass@localhost:5433/fas_test}"
TEST_DB_CONTAINER="${TEST_DB_CONTAINER:-fas_postgres}"

case "$TEST_DATABASE_URL" in
  */fas_test|*/fas_test\?*) ;;
  *)
    echo "Seguridad: TEST_DATABASE_URL debe apuntar a una base llamada fas_test." >&2
    exit 1
    ;;
esac

if ! docker inspect "$TEST_DB_CONTAINER" >/dev/null 2>&1; then
  echo "El contenedor PostgreSQL '$TEST_DB_CONTAINER' no existe." >&2
  exit 1
fi

if ! docker exec "$TEST_DB_CONTAINER" pg_isready -U fas_user -d postgres >/dev/null; then
  echo "PostgreSQL de pruebas no está disponible." >&2
  exit 1
fi

if ! docker exec "$TEST_DB_CONTAINER" \
  psql -U fas_user -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'fas_test'" \
  | grep -q 1; then
  docker exec "$TEST_DB_CONTAINER" createdb -U fas_user fas_test
fi

DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
DATABASE_URL="$TEST_DATABASE_URL" \
REDIS_URL="${TEST_REDIS_URL:-redis://:fas_redis_pass@localhost:6379}" \
BETTER_AUTH_SECRET="${TEST_BETTER_AUTH_SECRET:-test_secret_only_for_local_tests_32chars}" \
BETTER_AUTH_URL="${TEST_BETTER_AUTH_URL:-http://localhost:3001}" \
CORS_ORIGIN="${TEST_CORS_ORIGIN:-http://localhost:3000}" \
NODE_ENV=test \
  npx vitest run --config vitest.integration.config.ts
