-- Puerto asociado a una dirección de entidad (2026-10-19). Se usa para elegir
-- la dirección del agente de aduana según el puerto de zarpe en la Guía de
-- Despacho de exportación (DTE 52). Nullable y aditivo; FK simple a puertos.

ALTER TABLE "entidad_direcciones" ADD COLUMN "puertoId" INTEGER;

CREATE INDEX "entidad_direcciones_puertoId_idx" ON "entidad_direcciones"("puertoId");

ALTER TABLE "entidad_direcciones"
  ADD CONSTRAINT "entidad_direcciones_puertoId_fkey"
  FOREIGN KEY ("puertoId") REFERENCES "puertos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
