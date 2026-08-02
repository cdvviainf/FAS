-- Fase 3 multi-empresa, lote "Materiales": Articulo, Receta, TipoMovimiento,
-- SaldoArticulo y Movimiento pasan a ser por-empresa. Self-safe (nullable ->
-- backfill AGROSAN -> NOT NULL) — mismo patrón que los lotes anteriores
-- (Docs/empresas.md §3). Autosuficiente respecto del seed: el entrypoint de
-- despliegue corre `prisma migrate deploy` sin ejecutar el seed antes.
INSERT INTO "empresas" ("codigo", "razonSocial", "creadoPor")
VALUES ('AGROSAN', 'Frutera Agrosan SpA', 'system')
ON CONFLICT ("codigo") DO NOTHING;

-- ── 1. Agregar empresaId nullable a los 5 modelos ───────────────────────────
ALTER TABLE "articulos" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "recetas" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "tipos_movimiento" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "saldos_articulo" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "movimientos" ADD COLUMN "empresaId" INTEGER;

-- ── 2. Backfill: filas existentes (si las hay) se asocian a AGROSAN ─────────
UPDATE "articulos" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "recetas" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "tipos_movimiento" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "saldos_articulo" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "movimientos" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;

-- ── 3. NOT NULL solo después del backfill ───────────────────────────────────
ALTER TABLE "articulos" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "recetas" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "tipos_movimiento" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "saldos_articulo" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "movimientos" ALTER COLUMN "empresaId" SET NOT NULL;

-- ── 4. FK simple a empresas + índice regular ────────────────────────────────
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tipos_movimiento" ADD CONSTRAINT "tipos_movimiento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saldos_articulo" ADD CONSTRAINT "saldos_articulo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "articulos_empresaId_idx" ON "articulos"("empresaId");
CREATE INDEX "recetas_empresaId_idx" ON "recetas"("empresaId");
CREATE INDEX "tipos_movimiento_empresaId_idx" ON "tipos_movimiento"("empresaId");
CREATE INDEX "saldos_articulo_empresaId_idx" ON "saldos_articulo"("empresaId");
CREATE INDEX "movimientos_empresaId_idx" ON "movimientos"("empresaId");

-- ── 5. Único global de codigo -> (empresaId, codigo) ────────────────────────
-- A diferencia de lotes anteriores, Articulo/Receta/TipoMovimiento no tienen
-- `eliminadoEn` (usan `activo` boolean) — el reemplazo es un único normal,
-- sin condición parcial.
DROP INDEX "articulos_codigo_key";
DROP INDEX "recetas_codigo_key";
DROP INDEX "tipos_movimiento_codigo_key";

CREATE UNIQUE INDEX "articulos_empresaId_codigo_key" ON "articulos"("empresaId", "codigo");
CREATE UNIQUE INDEX "recetas_empresaId_codigo_key" ON "recetas"("empresaId", "codigo");
CREATE UNIQUE INDEX "tipos_movimiento_empresaId_codigo_key" ON "tipos_movimiento"("empresaId", "codigo");

-- ── 6. Único (empresaId, id) en los 3 lados-padre nuevos de FK compuesta ───
-- Entidad ya lo tiene desde el lote 3 (Calidad).
CREATE UNIQUE INDEX "bodegas_empresaId_id_key" ON "bodegas"("empresaId", "id");
CREATE UNIQUE INDEX "articulos_empresaId_id_key" ON "articulos"("empresaId", "id");
CREATE UNIQUE INDEX "tipos_movimiento_empresaId_id_key" ON "tipos_movimiento"("empresaId", "id");

-- ── 7. FK compuestas: 8 relaciones tenant->tenant de este lote ──────────────
ALTER TABLE "articulos" DROP CONSTRAINT "articulos_unidadId_fkey";
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_empresaId_unidadId_fkey" FOREIGN KEY ("empresaId", "unidadId") REFERENCES "unidades_medida"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recetas" DROP CONSTRAINT "recetas_embalajeId_fkey";
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_empresaId_embalajeId_fkey" FOREIGN KEY ("empresaId", "embalajeId") REFERENCES "articulos"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "saldos_articulo" DROP CONSTRAINT "saldos_articulo_articuloId_fkey";
ALTER TABLE "saldos_articulo" ADD CONSTRAINT "saldos_articulo_empresaId_articuloId_fkey" FOREIGN KEY ("empresaId", "articuloId") REFERENCES "articulos"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "saldos_articulo" DROP CONSTRAINT "saldos_articulo_bodegaId_fkey";
ALTER TABLE "saldos_articulo" ADD CONSTRAINT "saldos_articulo_empresaId_bodegaId_fkey" FOREIGN KEY ("empresaId", "bodegaId") REFERENCES "bodegas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimientos" DROP CONSTRAINT "movimientos_tipoMovimientoId_fkey";
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_empresaId_tipoMovimientoId_fkey" FOREIGN KEY ("empresaId", "tipoMovimientoId") REFERENCES "tipos_movimiento"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimientos" DROP CONSTRAINT "movimientos_entidadId_fkey";
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_empresaId_entidadId_fkey" FOREIGN KEY ("empresaId", "entidadId") REFERENCES "entidades"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "movimientos" DROP CONSTRAINT "movimientos_bodegaOrigenId_fkey";
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_empresaId_bodegaOrigenId_fkey" FOREIGN KEY ("empresaId", "bodegaOrigenId") REFERENCES "bodegas"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "movimientos" DROP CONSTRAINT "movimientos_bodegaDestinoId_fkey";
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_empresaId_bodegaDestinoId_fkey" FOREIGN KEY ("empresaId", "bodegaDestinoId") REFERENCES "bodegas"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "movimientos" DROP CONSTRAINT "movimientos_transporteEntidadId_fkey";
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_empresaId_transporteEntidadId_fkey" FOREIGN KEY ("empresaId", "transporteEntidadId") REFERENCES "entidades"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
