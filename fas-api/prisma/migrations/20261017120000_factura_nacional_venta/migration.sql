-- Factura Nacional desde Venta Nacional (Embarque con Cierre tipoVenta=NACIONAL),
-- 2026-10-17. Origen VENTA_NACIONAL: enlaza a Embarque, guarda tipo de cambio
-- (USD→CLP) y el precio de origen por línea para reconvertir si se edita.

ALTER TABLE "facturas_nacional" ADD COLUMN "embarqueId" INTEGER;
ALTER TABLE "facturas_nacional" ADD COLUMN "tipoCambio" DECIMAL(14,4);
ALTER TABLE "facturas_nacional" ADD COLUMN "fechaTipoCambio" TIMESTAMP(3);

ALTER TABLE "factura_nacional_lineas" ADD COLUMN "precioUnitarioOrigen" DECIMAL(14,4);

CREATE INDEX "facturas_nacional_embarqueId_idx" ON "facturas_nacional"("embarqueId");

-- A lo más una Factura Nacional activa por Embarque.
CREATE UNIQUE INDEX "facturas_nacional_embarque_activo_key"
  ON "facturas_nacional"("empresaId", "embarqueId")
  WHERE "eliminadoEn" IS NULL AND "embarqueId" IS NOT NULL;

ALTER TABLE "facturas_nacional"
  ADD CONSTRAINT "facturas_nacional_empresaId_embarqueId_fkey"
  FOREIGN KEY ("empresaId", "embarqueId") REFERENCES "embarques"("empresaId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
