-- Fase 3 multi-empresa, lote "Entidades": Entidad pasa a ser por-empresa.
-- Self-safe (nullable -> backfill AGROSAN -> NOT NULL) — mismo patrón que
-- los lotes anteriores (Docs/empresas.md §3). Autosuficiente respecto del
-- seed: el entrypoint de despliegue corre `prisma migrate deploy` sin
-- ejecutar el seed antes.
INSERT INTO "empresas" ("codigo", "razonSocial", "creadoPor")
VALUES ('AGROSAN', 'Frutera Agrosan SpA', 'system')
ON CONFLICT ("codigo") DO NOTHING;

-- ── 1. Agregar empresaId nullable ───────────────────────────────────────────
ALTER TABLE "entidades" ADD COLUMN "empresaId" INTEGER;

-- ── 2. Backfill: filas existentes se asocian a AGROSAN ─────────────────────
UPDATE "entidades" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;

-- ── 3. NOT NULL solo después del backfill ───────────────────────────────────
ALTER TABLE "entidades" ALTER COLUMN "empresaId" SET NOT NULL;

-- ── 4. FK simple a empresas + índice regular ────────────────────────────────
ALTER TABLE "entidades" ADD CONSTRAINT "entidades_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "entidades_empresaId_idx" ON "entidades"("empresaId");

-- ── 5. Únicos parciales globales preexistentes -> (empresaId, ...) ─────────
-- Mismo problema que en el lote 1 (Config/Mantenedores): "entidades" ya
-- tenía 2 índices únicos parciales GLOBALES creados antes de multi-empresa
-- (20260722000001_ent_enum_fields_indexes), invisibles en schema.prisma por
-- ser parciales. Se eliminan explícitamente antes de crear los reemplazos
-- (empresaId, ...) — si no, dos empresas nunca podrían compartir el mismo
-- código o identificador (RUT).
DROP INDEX "ux_entidades_codigo";
DROP INDEX "ux_entidades_identificador";

CREATE UNIQUE INDEX "entidades_empresa_codigo_activo_key" ON "entidades"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "entidades_empresa_identificador_activo_key" ON "entidades"("empresaId", "identificador") WHERE "eliminadoEn" IS NULL AND "identificador" IS NOT NULL;
