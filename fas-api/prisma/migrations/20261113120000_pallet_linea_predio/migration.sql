-- Predio de origen por línea de pallet (CSG del Excel de Recepción).
ALTER TABLE "pallet_lineas" ADD COLUMN "predioId" INTEGER;

CREATE INDEX "pallet_lineas_predioId_idx" ON "pallet_lineas"("predioId");

ALTER TABLE "pallet_lineas" ADD CONSTRAINT "pallet_lineas_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
