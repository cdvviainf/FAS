-- AlterTable
ALTER TABLE "alturas" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "bodegas" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "calibres" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "categorias" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "comunas" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "conceptos_cta_cte" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "especies" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "grupos_mercado" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "grupos_variedad" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "mercados" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "monedas" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "paises" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "parametros" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "provincias" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "puertos" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "regiones" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "temporadas" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tipos_defecto" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tipos_embarque" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tipos_pallet" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tipos_parametro" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tipos_produccion" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "unidades_medida" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "variedades" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "zonas" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false;
