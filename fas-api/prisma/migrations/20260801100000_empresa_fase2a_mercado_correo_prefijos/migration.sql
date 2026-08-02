-- Fase 2a multi-empresa: Mercado/GrupoMercado/ConfiguracionCorreo/PrefijoCodigo
-- pasan a ser por-empresa. Self-safe (nullable -> backfill AGROSAN -> NOT
-- NULL) — nunca NOT NULL directo sobre tablas potencialmente pobladas (ver
-- incidente 2026-07-29, Docs/empresas.md §3). Hoy estas 4 tablas están vacías
-- en todos los ambientes conocidos (Mercado/GrupoMercado nunca se sembraron;
-- ConfiguracionCorreo/PrefijoCodigo se configuran manualmente desde la UI),
-- así que el backfill no mueve filas reales — pero se escribe completo por
-- si un ambiente ya tiene datos cargados manualmente.

-- Asegura que AGROSAN exista ANTES del backfill: el entrypoint de despliegue
-- corre `prisma migrate deploy` sin ejecutar el seed antes (ver Dockerfile),
-- así que esta migración no puede depender de que alguien ya haya sembrado
-- manualmente (FAS-EMP-F2-AMB-AGROSAN). Idempotente — si el seed ya corrió,
-- no hace nada.
INSERT INTO "empresas" ("codigo", "razonSocial", "creadoPor")
VALUES ('AGROSAN', 'Frutera Agrosan SpA', 'system')
ON CONFLICT ("codigo") DO NOTHING;

-- AlterTable: agregar empresaId nullable
ALTER TABLE "mercados" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "grupos_mercado" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "configuracion_correo" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "prefijos_codigo" ADD COLUMN "empresaId" INTEGER;

-- Backfill: filas existentes (si las hay) se asocian a AGROSAN, la empresa
-- base (Docs/empresas.md §3).
UPDATE "mercados" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "grupos_mercado" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "configuracion_correo" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "prefijos_codigo" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;

-- AlterTable: NOT NULL solo después del backfill
ALTER TABLE "mercados" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "grupos_mercado" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "configuracion_correo" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "prefijos_codigo" ALTER COLUMN "empresaId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "grupos_mercado" ADD CONSTRAINT "grupos_mercado_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "configuracion_correo" ADD CONSTRAINT "configuracion_correo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prefijos_codigo" ADD CONSTRAINT "prefijos_codigo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex (regulares, para joins/filtros por empresa)
CREATE INDEX "mercados_empresaId_idx" ON "mercados"("empresaId");
CREATE INDEX "grupos_mercado_empresaId_idx" ON "grupos_mercado"("empresaId");
CREATE INDEX "prefijos_codigo_empresaId_idx" ON "prefijos_codigo"("empresaId");

-- CreateIndex: configuracion_correo, una fila por empresa (sin soft-delete,
-- unique simple de Prisma)
CREATE UNIQUE INDEX "configuracion_correo_empresaId_key" ON "configuracion_correo"("empresaId");

-- CreateIndex: mercados/grupos_mercado tienen soft-delete — único parcial
-- solo entre filas activas (mismo patrón que prefijos_codigo, no
-- representable en el DSL de Prisma).
CREATE UNIQUE INDEX "mercados_empresa_codigo_activo_key" ON "mercados"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "grupos_mercado_empresa_codigo_activo_key" ON "grupos_mercado"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;

-- DropIndex: prefijos_codigo pasa de único por (modelo) a único por
-- (empresaId, modelo) — cada empresa configura su propio prefijo/dígitos.
DROP INDEX "prefijos_codigo_modelo_activo_key";
CREATE UNIQUE INDEX "prefijos_codigo_empresa_modelo_activo_key" ON "prefijos_codigo"("empresaId", "modelo") WHERE "eliminadoEn" IS NULL;

-- FAS-EMP-F2-R3-005: Mercado -> GrupoMercado pasa de FK simple a FK compuesta
-- (empresaId, grupoMercadoId) -> grupos_mercado(empresaId, id). Cierra a
-- nivel de BD el vector de escrituras anidadas que la extensión de tenancy
-- (prisma-tenancy.ts) no puede interceptar — un Mercado ya no puede quedar en
-- una empresa distinta a la de su GrupoMercado, sin importar cómo se creó.
CREATE UNIQUE INDEX "grupos_mercado_empresaId_id_key" ON "grupos_mercado"("empresaId", "id");
ALTER TABLE "mercados" DROP CONSTRAINT "mercados_grupoMercadoId_fkey";
ALTER TABLE "mercados" ADD CONSTRAINT "mercados_empresaId_grupoMercadoId_fkey" FOREIGN KEY ("empresaId", "grupoMercadoId") REFERENCES "grupos_mercado"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
