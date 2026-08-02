-- Fase 3 multi-empresa, lote "Ventas": NotaVenta, Embarque e
-- InstructivoEmbalaje pasan a ser por-empresa. Self-safe (nullable ->
-- backfill AGROSAN -> NOT NULL) — mismo patrón que los lotes anteriores
-- (Docs/empresas.md §3). Autosuficiente respecto del seed: el entrypoint de
-- despliegue corre `prisma migrate deploy` sin ejecutar el seed antes.
INSERT INTO "empresas" ("codigo", "razonSocial", "creadoPor")
VALUES ('AGROSAN', 'Frutera Agrosan SpA', 'system')
ON CONFLICT ("codigo") DO NOTHING;

-- ── 1. Agregar empresaId nullable a los 3 modelos ───────────────────────────
ALTER TABLE "notas_venta" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "embarques" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "instructivos_embalaje" ADD COLUMN "empresaId" INTEGER;

-- ── 2. Backfill: filas existentes (si las hay) se asocian a AGROSAN ─────────
UPDATE "notas_venta" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "embarques" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "instructivos_embalaje" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;

-- ── 3. NOT NULL solo después del backfill ───────────────────────────────────
ALTER TABLE "notas_venta" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "embarques" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "instructivos_embalaje" ALTER COLUMN "empresaId" SET NOT NULL;

-- ── 4. FK simple a empresas + índice regular ────────────────────────────────
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "embarques" ADD CONSTRAINT "embarques_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instructivos_embalaje" ADD CONSTRAINT "instructivos_embalaje_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "notas_venta_empresaId_idx" ON "notas_venta"("empresaId");
CREATE INDEX "embarques_empresaId_idx" ON "embarques"("empresaId");
CREATE INDEX "instructivos_embalaje_empresaId_idx" ON "instructivos_embalaje"("empresaId");

-- ── 5. Únicos globales -> (empresaId, ...) ──────────────────────────────────
-- NotaVenta y Embarque tienen eliminadoEn (soft delete) -> único parcial.
-- InstructivoEmbalaje no tiene eliminadoEn -> único normal (mismo caso que
-- Articulo/Receta/TipoMovimiento en el lote Materiales).
DROP INDEX "notas_venta_folio_key";
DROP INDEX "embarques_numeroInstructivo_key";
DROP INDEX "instructivos_embalaje_numero_key";

CREATE UNIQUE INDEX "notas_venta_empresa_folio_activo_key" ON "notas_venta"("empresaId", "folio") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "embarques_empresa_numeroInstructivo_activo_key" ON "embarques"("empresaId", "numeroInstructivo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "instructivos_embalaje_empresaId_numero_key" ON "instructivos_embalaje"("empresaId", "numero");

-- ── 6. Único (empresaId, id) en los 3 nuevos lados-padre de FK compuesta ───
-- Entidad, TipoEmbarque y Mercado ya lo tienen desde lotes anteriores.
CREATE UNIQUE INDEX "puertos_empresaId_id_key" ON "puertos"("empresaId", "id");
CREATE UNIQUE INDEX "parametros_empresaId_id_key" ON "parametros"("empresaId", "id");
CREATE UNIQUE INDEX "notas_venta_empresaId_id_key" ON "notas_venta"("empresaId", "id");

-- ── 7. FK compuestas: 11 relaciones tenant->tenant de este lote ─────────────
ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_clienteId_fkey";
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_clienteId_fkey" FOREIGN KEY ("empresaId", "clienteId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_notifyId_fkey";
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_notifyId_fkey" FOREIGN KEY ("empresaId", "notifyId") REFERENCES "entidades"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_clienteFinalId_fkey";
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_clienteFinalId_fkey" FOREIGN KEY ("empresaId", "clienteFinalId") REFERENCES "entidades"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_tipoEmbarqueId_fkey";
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_tipoEmbarqueId_fkey" FOREIGN KEY ("empresaId", "tipoEmbarqueId") REFERENCES "tipos_embarque"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_mercadoId_fkey";
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_mercadoId_fkey" FOREIGN KEY ("empresaId", "mercadoId") REFERENCES "mercados"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_puertoDestinoId_fkey";
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_puertoDestinoId_fkey" FOREIGN KEY ("empresaId", "puertoDestinoId") REFERENCES "puertos"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_modalidadVentaId_fkey";
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_modalidadVentaId_fkey" FOREIGN KEY ("empresaId", "modalidadVentaId") REFERENCES "parametros"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_clausulaVentaId_fkey";
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_clausulaVentaId_fkey" FOREIGN KEY ("empresaId", "clausulaVentaId") REFERENCES "parametros"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_tipoFleteId_fkey";
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_tipoFleteId_fkey" FOREIGN KEY ("empresaId", "tipoFleteId") REFERENCES "parametros"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "embarques" DROP CONSTRAINT "embarques_notaVentaId_fkey";
ALTER TABLE "embarques" ADD CONSTRAINT "embarques_empresaId_notaVentaId_fkey" FOREIGN KEY ("empresaId", "notaVentaId") REFERENCES "notas_venta"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "instructivos_embalaje" DROP CONSTRAINT "instructivos_embalaje_notaVentaId_fkey";
ALTER TABLE "instructivos_embalaje" ADD CONSTRAINT "instructivos_embalaje_empresaId_notaVentaId_fkey" FOREIGN KEY ("empresaId", "notaVentaId") REFERENCES "notas_venta"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
