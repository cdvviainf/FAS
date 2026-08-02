-- Fase 2b multi-empresa: refactor País↔Mercado. Pais es geografía global,
-- pero a qué mercado pertenece un país es una decisión comercial de cada
-- empresa (Mercado es por-empresa desde Fase 2a) — la FK global->tenant
-- "paises.mercadoId" deja de ser válida. Se reemplaza por MercadoPais
-- (empresaId, mercadoId, paisId), con backfill de los datos existentes antes
-- de eliminar la columna vieja (Docs/empresas.md §5).

-- Autosuficiente respecto del seed (mismo motivo que Fase 2a): el entrypoint
-- de despliegue corre `prisma migrate deploy` sin ejecutar el seed antes.
INSERT INTO "empresas" ("codigo", "razonSocial", "creadoPor")
VALUES ('AGROSAN', 'Frutera Agrosan SpA', 'system')
ON CONFLICT ("codigo") DO NOTHING;

-- CreateTable
CREATE TABLE "mercado_paises" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "mercadoId" INTEGER NOT NULL,
    "paisId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,

    CONSTRAINT "mercado_paises_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "mercado_paises" ADD CONSTRAINT "mercado_paises_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mercado_paises" ADD CONSTRAINT "mercado_paises_mercadoId_fkey" FOREIGN KEY ("mercadoId") REFERENCES "mercados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mercado_paises" ADD CONSTRAINT "mercado_paises_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "paises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "mercado_paises_empresaId_paisId_key" ON "mercado_paises"("empresaId", "paisId");
CREATE INDEX "mercado_paises_empresaId_mercadoId_idx" ON "mercado_paises"("empresaId", "mercadoId");

-- Backfill: cada país existente se asocia a AGROSAN con su mercado actual
-- (todos los datos existentes se asocian a la empresa base, Docs/empresas.md
-- §3). Vacío hoy en todos los ambientes conocidos (tabla paises sin filas
-- reales aún), pero se escribe completo por si un ambiente ya tiene datos.
INSERT INTO "mercado_paises" ("empresaId", "mercadoId", "paisId", "creadoPor")
SELECT (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN'), "mercadoId", "id", 'system'
FROM "paises";

-- DropForeignKey + DropColumn: paises.mercadoId reemplazado por MercadoPais
ALTER TABLE "paises" DROP CONSTRAINT "paises_mercadoId_fkey";
ALTER TABLE "paises" DROP COLUMN "mercadoId";
