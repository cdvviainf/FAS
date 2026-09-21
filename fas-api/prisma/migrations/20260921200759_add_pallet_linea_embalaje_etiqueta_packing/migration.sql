-- AlterTable
-- Columnas nullable a nivel de BD (IMP-QA-R1-032, QA ronda 1/2): obligatorias
-- en el flujo de carga por Excel (Etapa 2 de recepciones.motor.ts), pero un
-- NOT NULL duro rompería esta migración sobre cualquier PalletLinea histórica
-- ya existente, sin un backfill real posible (no hay dato de negocio para
-- reconstruir con qué Packing/Etiqueta/fecha se embaló una carga pasada).
ALTER TABLE "pallet_lineas"
  ADD COLUMN "fechaEmbalaje" TIMESTAMP(3),
  ADD COLUMN "etiquetaId" INTEGER,
  ADD COLUMN "packingId" INTEGER;

-- AddForeignKey
ALTER TABLE "pallet_lineas" ADD CONSTRAINT "pallet_lineas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallet_lineas" ADD CONSTRAINT "pallet_lineas_packingId_fkey" FOREIGN KEY ("packingId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
