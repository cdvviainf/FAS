#!/usr/bin/env bash
#
# Reset completo + Carga Masiva de Maestros, en un solo paso.
# Encadena, EN ORDEN: wipe -> geografía -> seed -> carga:base -> carga (commit).
#
# Uso:
#   npm run carga:reset-completo -- --force [ruta-excel.xlsx] [--empresa=AGROSAN]
#
# Sin --force muestra qué hará y aborta (es DESTRUCTIVO: trunca maestros +
# transaccional, preservando auth/tenant/menú).
set -euo pipefail
cd "$(dirname "$0")/.."   # fas-api/

ARCHIVO="../XLS/Carga_Masiva_Maestros_FAS_corregido.xlsx"
EMPRESA_ARG=""
FORCE=false
for a in "$@"; do
  case "$a" in
    --force) FORCE=true ;;
    --empresa=*) EMPRESA_ARG="$a" ;;
    -*) echo "Opción desconocida: $a" >&2; exit 1 ;;
    *) ARCHIVO="$a" ;;
  esac
done

if [ "$FORCE" != "true" ]; then
  echo "RESET COMPLETO (destructivo). Ejecutará, en orden:"
  echo "  1) wipe (trunca maestros + transaccional, preserva auth/tenant/menú)"
  echo "  2) seed geografía   3) seed base   4) carga:base   5) carga '$ARCHIVO' --commit"
  echo
  echo "Para ejecutarlo agrega --force:  npm run carga:reset-completo -- --force"
  exit 0
fi

echo "════════ 1/5) WIPE ════════"
npx tsx prisma/wipe-transaccional.ts --force
echo "════════ 2/5) SEED GEOGRAFÍA ════════"
npm run -s db:seed:geografia
echo "════════ 3/5) SEED BASE ════════"
npm run -s db:seed
echo "════════ 4/5) CARGA BASE (prefijos + externos) ════════"
npx tsx prisma/carga-maestros-base.ts
echo "════════ 5/5) CARGA DEL EXCEL (--commit) ════════"
npx tsx prisma/carga-maestros-cargar.ts "$ARCHIVO" --commit ${EMPRESA_ARG:+"$EMPRESA_ARG"}

echo
echo "✔ Reset completo terminado."
