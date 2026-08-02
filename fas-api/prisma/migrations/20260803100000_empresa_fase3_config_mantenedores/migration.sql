-- Fase 3 multi-empresa, lote "Config/Mantenedores": 19 modelos pasan a ser
-- por-empresa. Self-safe (nullable -> backfill AGROSAN -> NOT NULL) — nunca
-- NOT NULL directo sobre tablas potencialmente pobladas (Docs/empresas.md
-- §3). Autosuficiente respecto del seed (mismo motivo que Fase 2a/2b): el
-- entrypoint de despliegue corre `prisma migrate deploy` sin ejecutar el
-- seed antes.
INSERT INTO "empresas" ("codigo", "razonSocial", "creadoPor")
VALUES ('AGROSAN', 'Frutera Agrosan SpA', 'system')
ON CONFLICT ("codigo") DO NOTHING;

-- ── 1. Agregar empresaId nullable a los 19 modelos ──────────────────────────
ALTER TABLE "tipos_embarque" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "formas_pago" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "unidades_medida" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "tipos_pallet" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "alturas" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "tipos_produccion" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "tipos_defecto" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "tipos_parametro" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "puertos" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "temporadas" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "bodegas" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "conceptos_cta_cte" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "especies" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "grupos_variedad" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "variedades" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "categorias" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "calibres" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "parametros" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "calificaciones" ADD COLUMN "empresaId" INTEGER;

-- ── 2. Backfill: filas existentes (si las hay) se asocian a AGROSAN ─────────
UPDATE "tipos_embarque" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "formas_pago" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "unidades_medida" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "tipos_pallet" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "alturas" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "tipos_produccion" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "tipos_defecto" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "tipos_parametro" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "puertos" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "temporadas" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "bodegas" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "conceptos_cta_cte" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "especies" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "grupos_variedad" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "variedades" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "categorias" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "calibres" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "parametros" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "calificaciones" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;

-- ── 3. NOT NULL solo después del backfill ───────────────────────────────────
ALTER TABLE "tipos_embarque" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "formas_pago" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "unidades_medida" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "tipos_pallet" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "alturas" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "tipos_produccion" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "tipos_defecto" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "tipos_parametro" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "puertos" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "temporadas" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "bodegas" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "conceptos_cta_cte" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "especies" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "grupos_variedad" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "variedades" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "categorias" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "calibres" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "parametros" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "calificaciones" ALTER COLUMN "empresaId" SET NOT NULL;

-- ── 4. FK simple a empresas + índice regular ────────────────────────────────
ALTER TABLE "tipos_embarque" ADD CONSTRAINT "tipos_embarque_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "formas_pago" ADD CONSTRAINT "formas_pago_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unidades_medida" ADD CONSTRAINT "unidades_medida_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tipos_pallet" ADD CONSTRAINT "tipos_pallet_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alturas" ADD CONSTRAINT "alturas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tipos_produccion" ADD CONSTRAINT "tipos_produccion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tipos_defecto" ADD CONSTRAINT "tipos_defecto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tipos_parametro" ADD CONSTRAINT "tipos_parametro_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "puertos" ADD CONSTRAINT "puertos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "temporadas" ADD CONSTRAINT "temporadas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bodegas" ADD CONSTRAINT "bodegas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conceptos_cta_cte" ADD CONSTRAINT "conceptos_cta_cte_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "especies" ADD CONSTRAINT "especies_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grupos_variedad" ADD CONSTRAINT "grupos_variedad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "variedades" ADD CONSTRAINT "variedades_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calibres" ADD CONSTRAINT "calibres_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "parametros" ADD CONSTRAINT "parametros_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "tipos_embarque_empresaId_idx" ON "tipos_embarque"("empresaId");
CREATE INDEX "formas_pago_empresaId_idx" ON "formas_pago"("empresaId");
CREATE INDEX "unidades_medida_empresaId_idx" ON "unidades_medida"("empresaId");
CREATE INDEX "tipos_pallet_empresaId_idx" ON "tipos_pallet"("empresaId");
CREATE INDEX "alturas_empresaId_idx" ON "alturas"("empresaId");
CREATE INDEX "tipos_produccion_empresaId_idx" ON "tipos_produccion"("empresaId");
CREATE INDEX "tipos_defecto_empresaId_idx" ON "tipos_defecto"("empresaId");
CREATE INDEX "tipos_parametro_empresaId_idx" ON "tipos_parametro"("empresaId");
CREATE INDEX "puertos_empresaId_idx" ON "puertos"("empresaId");
CREATE INDEX "temporadas_empresaId_idx" ON "temporadas"("empresaId");
CREATE INDEX "bodegas_empresaId_idx" ON "bodegas"("empresaId");
CREATE INDEX "conceptos_cta_cte_empresaId_idx" ON "conceptos_cta_cte"("empresaId");
CREATE INDEX "especies_empresaId_idx" ON "especies"("empresaId");
CREATE INDEX "grupos_variedad_empresaId_idx" ON "grupos_variedad"("empresaId");
CREATE INDEX "variedades_empresaId_idx" ON "variedades"("empresaId");
CREATE INDEX "categorias_empresaId_idx" ON "categorias"("empresaId");
CREATE INDEX "calibres_empresaId_idx" ON "calibres"("empresaId");
CREATE INDEX "parametros_empresaId_idx" ON "parametros"("empresaId");
CREATE INDEX "calificaciones_empresaId_idx" ON "calificaciones"("empresaId");

-- ── 5. Único parcial (empresaId, codigo) solo entre filas activas ───────────
-- FAS-EMP-F3-R1-001 (QA ronda 1): a diferencia de Mercado/GrupoMercado
-- (Fase 2a, nunca tuvieron ningún unique), estos 19 modelos SÍ tenían un
-- índice único parcial GLOBAL sobre "codigo" (creado en migraciones previas
-- a multi-empresa, ej. 20260713_add_unique_partial_indexes*) — no
-- representable en el DSL de Prisma, así que no aparecía en schema.prisma y
-- se pasó por alto al planificar este lote. Hay que eliminarlos explícita-
-- mente antes de que el único (empresaId, codigo) de abajo tenga sentido —
-- si no, dos empresas nunca podrían compartir un código igual.
DROP INDEX "tipos_embarque_codigo_activo_idx";
DROP INDEX "ux_formas_pago_codigo";
DROP INDEX "unidades_medida_codigo_activo_idx";
DROP INDEX "tipos_pallet_codigo_activo_idx";
DROP INDEX "alturas_codigo_activo_idx";
DROP INDEX "tipos_produccion_codigo_activo_idx";
DROP INDEX "tipos_defecto_codigo_activo_idx";
DROP INDEX "tipos_parametro_codigo_activo_idx";
DROP INDEX "ux_puertos_codigo";
DROP INDEX "ux_temporadas_codigo";
DROP INDEX "ux_bodegas_codigo";
DROP INDEX "ux_conceptos_cta_cte_codigo";
DROP INDEX "ux_especies_codigo";
DROP INDEX "ux_grupos_variedad_codigo";
DROP INDEX "ux_variedades_codigo";
DROP INDEX "ux_categorias_codigo";
DROP INDEX "ux_calibres_codigo";
DROP INDEX "ux_parametros_codigo";
DROP INDEX "ux_calificaciones_codigo";

-- FAS-EMP-F3-R1-002: mismo problema con la temporada predeterminada — el
-- índice único parcial era GLOBAL (a lo sumo una predeterminada en TODO el
-- sistema). Se reemplaza por uno acotado a empresaId (a lo sumo una
-- predeterminada POR EMPRESA).
DROP INDEX "ux_temporadas_una_predeterminada";
CREATE UNIQUE INDEX "ux_temporadas_una_predeterminada_por_empresa"
  ON "temporadas" ("empresaId")
  WHERE "predeterminada" = true AND "eliminadoEn" IS NULL;

-- Ninguno de estos 19 modelos tenía @@unique(codigo) en el DSL de Prisma
-- (unicidad expresada solo vía índice parcial crudo, ver arriba) — mismo
-- patrón que PrefijoCodigo/Mercado/GrupoMercado.
CREATE UNIQUE INDEX "tipos_embarque_empresa_codigo_activo_key" ON "tipos_embarque"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "formas_pago_empresa_codigo_activo_key" ON "formas_pago"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "unidades_medida_empresa_codigo_activo_key" ON "unidades_medida"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "tipos_pallet_empresa_codigo_activo_key" ON "tipos_pallet"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "alturas_empresa_codigo_activo_key" ON "alturas"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "tipos_produccion_empresa_codigo_activo_key" ON "tipos_produccion"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "tipos_defecto_empresa_codigo_activo_key" ON "tipos_defecto"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "tipos_parametro_empresa_codigo_activo_key" ON "tipos_parametro"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "puertos_empresa_codigo_activo_key" ON "puertos"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "temporadas_empresa_codigo_activo_key" ON "temporadas"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "bodegas_empresa_codigo_activo_key" ON "bodegas"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "conceptos_cta_cte_empresa_codigo_activo_key" ON "conceptos_cta_cte"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "especies_empresa_codigo_activo_key" ON "especies"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "grupos_variedad_empresa_codigo_activo_key" ON "grupos_variedad"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "variedades_empresa_codigo_activo_key" ON "variedades"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "categorias_empresa_codigo_activo_key" ON "categorias"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "calibres_empresa_codigo_activo_key" ON "calibres"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "parametros_empresa_codigo_activo_key" ON "parametros"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "calificaciones_empresa_codigo_activo_key" ON "calificaciones"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;

-- ── 6. Único (empresaId, id) en los 5 lados-padre de FK compuesta ──────────
-- Target de las FK compuestas de abajo (mismo motivo que GrupoMercado en
-- Fase 2a: Postgres exige un índice único explícito sobre exactamente esa
-- tupla, no lo infiere del PK aunque "id" ya sea único por sí solo).
CREATE UNIQUE INDEX "tipos_embarque_empresaId_id_key" ON "tipos_embarque"("empresaId", "id");
CREATE UNIQUE INDEX "unidades_medida_empresaId_id_key" ON "unidades_medida"("empresaId", "id");
CREATE UNIQUE INDEX "especies_empresaId_id_key" ON "especies"("empresaId", "id");
CREATE UNIQUE INDEX "grupos_variedad_empresaId_id_key" ON "grupos_variedad"("empresaId", "id");
CREATE UNIQUE INDEX "tipos_parametro_empresaId_id_key" ON "tipos_parametro"("empresaId", "id");

-- ── 7. FK compuestas: 8 relaciones tenant->tenant dentro de este lote ───────
-- Mismo patrón que Mercado↔GrupoMercado (Fase 2a) — imposible a nivel de BD
-- que un hijo quede en una empresa distinta a la de su padre tenant, aunque
-- una escritura anidada de Prisma bypasee la extensión de tenancy.
ALTER TABLE "puertos" DROP CONSTRAINT "puertos_tipoEmbarqueId_fkey";
ALTER TABLE "puertos" ADD CONSTRAINT "puertos_empresaId_tipoEmbarqueId_fkey" FOREIGN KEY ("empresaId", "tipoEmbarqueId") REFERENCES "tipos_embarque"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "especies" DROP CONSTRAINT "especies_unidadMedidaCalidadId_fkey";
ALTER TABLE "especies" ADD CONSTRAINT "especies_empresaId_unidadMedidaCalidadId_fkey" FOREIGN KEY ("empresaId", "unidadMedidaCalidadId") REFERENCES "unidades_medida"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "grupos_variedad" DROP CONSTRAINT "grupos_variedad_especieId_fkey";
ALTER TABLE "grupos_variedad" ADD CONSTRAINT "grupos_variedad_empresaId_especieId_fkey" FOREIGN KEY ("empresaId", "especieId") REFERENCES "especies"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "variedades" DROP CONSTRAINT "variedades_especieId_fkey";
ALTER TABLE "variedades" ADD CONSTRAINT "variedades_empresaId_especieId_fkey" FOREIGN KEY ("empresaId", "especieId") REFERENCES "especies"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "variedades" DROP CONSTRAINT "variedades_grupoVariedadId_fkey";
ALTER TABLE "variedades" ADD CONSTRAINT "variedades_empresaId_grupoVariedadId_fkey" FOREIGN KEY ("empresaId", "grupoVariedadId") REFERENCES "grupos_variedad"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "categorias" DROP CONSTRAINT "categorias_especieId_fkey";
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_empresaId_especieId_fkey" FOREIGN KEY ("empresaId", "especieId") REFERENCES "especies"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calibres" DROP CONSTRAINT "calibres_especieId_fkey";
ALTER TABLE "calibres" ADD CONSTRAINT "calibres_empresaId_especieId_fkey" FOREIGN KEY ("empresaId", "especieId") REFERENCES "especies"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "parametros" DROP CONSTRAINT "parametros_tipoParametroId_fkey";
ALTER TABLE "parametros" ADD CONSTRAINT "parametros_empresaId_tipoParametroId_fkey" FOREIGN KEY ("empresaId", "tipoParametroId") REFERENCES "tipos_parametro"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
