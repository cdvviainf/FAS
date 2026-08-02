-- Fase 3 multi-empresa, lote "Productores": Predio, ProductorContrato,
-- MovimientoCuentaCorriente y ConceptoLiquidacion pasan a ser por-empresa.
-- Self-safe (nullable -> backfill AGROSAN -> NOT NULL) — mismo patrón que
-- los lotes anteriores (Docs/empresas.md §3). Autosuficiente respecto del
-- seed: el entrypoint de despliegue corre `prisma migrate deploy` sin
-- ejecutar el seed antes.
INSERT INTO "empresas" ("codigo", "razonSocial", "creadoPor")
VALUES ('AGROSAN', 'Frutera Agrosan SpA', 'system')
ON CONFLICT ("codigo") DO NOTHING;

-- ── 1. Agregar empresaId nullable a los 4 modelos ───────────────────────────
ALTER TABLE "predios" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "productor_contratos" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "movimientos_cuenta_corriente" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "conceptos_liquidacion" ADD COLUMN "empresaId" INTEGER;

-- ── 2. Backfill: filas existentes (si las hay) se asocian a AGROSAN ─────────
UPDATE "predios" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "productor_contratos" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "movimientos_cuenta_corriente" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "conceptos_liquidacion" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;

-- ── 3. NOT NULL solo después del backfill ───────────────────────────────────
ALTER TABLE "predios" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "productor_contratos" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "movimientos_cuenta_corriente" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "conceptos_liquidacion" ALTER COLUMN "empresaId" SET NOT NULL;

-- ── 4. FK simple a empresas + índice regular ────────────────────────────────
ALTER TABLE "predios" ADD CONSTRAINT "predios_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "productor_contratos" ADD CONSTRAINT "productor_contratos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_cuenta_corriente" ADD CONSTRAINT "movimientos_cuenta_corriente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conceptos_liquidacion" ADD CONSTRAINT "conceptos_liquidacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "predios_empresaId_idx" ON "predios"("empresaId");
CREATE INDEX "productor_contratos_empresaId_idx" ON "productor_contratos"("empresaId");
CREATE INDEX "movimientos_cuenta_corriente_empresaId_idx" ON "movimientos_cuenta_corriente"("empresaId");
CREATE INDEX "conceptos_liquidacion_empresaId_idx" ON "conceptos_liquidacion"("empresaId");

-- ── 5. Único (empresaId, id) en los 2 nuevos lados-padre de FK compuesta ───
-- Entidad, Temporada y Especie ya lo tienen desde los lotes 1/3.
CREATE UNIQUE INDEX "tipos_produccion_empresaId_id_key" ON "tipos_produccion"("empresaId", "id");
CREATE UNIQUE INDEX "conceptos_cta_cte_empresaId_id_key" ON "conceptos_cta_cte"("empresaId", "id");

-- ── 6. FK compuestas: 7 relaciones tenant->tenant de este lote ──────────────
ALTER TABLE "predios" DROP CONSTRAINT "predios_entidadId_fkey";
ALTER TABLE "predios" ADD CONSTRAINT "predios_empresaId_entidadId_fkey" FOREIGN KEY ("empresaId", "entidadId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "predios" DROP CONSTRAINT "predios_tipoProduccionId_fkey";
ALTER TABLE "predios" ADD CONSTRAINT "predios_empresaId_tipoProduccionId_fkey" FOREIGN KEY ("empresaId", "tipoProduccionId") REFERENCES "tipos_produccion"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "productor_contratos" DROP CONSTRAINT "productor_contratos_entidadId_fkey";
ALTER TABLE "productor_contratos" ADD CONSTRAINT "productor_contratos_empresaId_entidadId_fkey" FOREIGN KEY ("empresaId", "entidadId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "productor_contratos" DROP CONSTRAINT "productor_contratos_temporadaId_fkey";
ALTER TABLE "productor_contratos" ADD CONSTRAINT "productor_contratos_empresaId_temporadaId_fkey" FOREIGN KEY ("empresaId", "temporadaId") REFERENCES "temporadas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "productor_contratos" DROP CONSTRAINT "productor_contratos_especieId_fkey";
ALTER TABLE "productor_contratos" ADD CONSTRAINT "productor_contratos_empresaId_especieId_fkey" FOREIGN KEY ("empresaId", "especieId") REFERENCES "especies"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimientos_cuenta_corriente" DROP CONSTRAINT "movimientos_cuenta_corriente_entidadId_fkey";
ALTER TABLE "movimientos_cuenta_corriente" ADD CONSTRAINT "movimientos_cuenta_corriente_empresaId_entidadId_fkey" FOREIGN KEY ("empresaId", "entidadId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimientos_cuenta_corriente" DROP CONSTRAINT "movimientos_cuenta_corriente_tipoId_fkey";
ALTER TABLE "movimientos_cuenta_corriente" ADD CONSTRAINT "movimientos_cuenta_corriente_empresaId_tipoId_fkey" FOREIGN KEY ("empresaId", "tipoId") REFERENCES "conceptos_cta_cte"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
