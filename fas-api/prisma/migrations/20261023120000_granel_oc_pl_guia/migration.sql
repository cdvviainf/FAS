-- Granel en Órdenes de Compra + columnas de Guía (N°/Emisor) por pallet en el
-- Packing List (2026-10-23).

-- 1) Nuevo valor de enum TipoArticulo: GRANEL.
--    (ADD VALUE no se usa en esta misma migración, así que es seguro en la tx.)
ALTER TYPE "TipoArticulo" ADD VALUE 'GRANEL';

-- 2) Modalidad de compra de la OC.
CREATE TYPE "ModalidadCompra" AS ENUM ('CAJAS', 'GRANEL');

ALTER TABLE "ordenes_compra"
  ADD COLUMN "modalidad" "ModalidadCompra" NOT NULL DEFAULT 'CAJAS';

-- 3) Líneas de OC: los campos de CAJAS pasan a nullable (no aplican en GRANEL) y
--    se agregan los de GRANEL (kilos + precio por kilo).
ALTER TABLE "orden_compra_linea"
  ALTER COLUMN "categoriaId"     DROP NOT NULL,
  ALTER COLUMN "cantidadPallets" DROP NOT NULL,
  ALTER COLUMN "cajasPorPallet"  DROP NOT NULL,
  ALTER COLUMN "cajas"           DROP NOT NULL,
  ALTER COLUMN "precioUsdCaja"   DROP NOT NULL,
  ADD COLUMN  "cantidadKilos" DECIMAL(14,2),
  ADD COLUMN  "precioUsdKilo" DECIMAL(14,4);

-- 4) Guía de despacho por pallet (columnas del Packing List): número + emisor
--    (Entidad PRODUCTOR/PLANTA). FK compuesta multiempresa, misma convención que
--    las demás FK de pallets.
ALTER TABLE "pallets"
  ADD COLUMN "numeroGuiaDespacho" TEXT,
  ADD COLUMN "emisorGuiaId" INTEGER;

CREATE INDEX "pallets_emisorGuiaId_idx" ON "pallets"("emisorGuiaId");

ALTER TABLE "pallets"
  ADD CONSTRAINT "pallets_empresaId_emisorGuiaId_fkey"
  FOREIGN KEY ("empresaId", "emisorGuiaId")
  REFERENCES "entidades"("empresaId", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;
