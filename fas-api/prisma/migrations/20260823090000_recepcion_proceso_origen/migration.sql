-- Etapa 3 — Recepción de Proceso (2026-08-23, compras.md §7 / calidad.md).
-- Agrega el valor PROCESO a OrigenRecepcion: una Recepción sin OC puede ser
-- CONSIGNACION (sin validación) o PROCESO (cada N° de Pallet del Excel debe
-- corresponder a un InstructivoEmbalajeFolio APROBADO). No se usa el valor
-- nuevo en esta misma migración — solo se agrega al tipo; Postgres no
-- permite usar un valor de enum recién agregado en la misma transacción en
-- que se agregó (mismo motivo por el que Etapa 1A partió su migración en 2
-- archivos), pero acá no hace falta: no hay backfill que lo use.

-- AlterEnum
ALTER TYPE "OrigenRecepcion" ADD VALUE 'PROCESO';
