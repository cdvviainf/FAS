#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Build API"
npm --prefix "$PROJECT_ROOT/fas-api" run build

echo "==> Pruebas unitarias API"
npm --prefix "$PROJECT_ROOT/fas-api" run test:run

echo "==> Pruebas de integración API + PostgreSQL fas_test"
npm --prefix "$PROJECT_ROOT/fas-api" run test:integration

echo "==> Build web"
npm --prefix "$PROJECT_ROOT/fas-web" run build

echo "==> Validación local completa"
