-- Temperatura (°C) y termógrafo por pallet (2026-10-25), capturados en la
-- reconciliación del Packing List y usados en la emisión del reporte.
ALTER TABLE "pallets"
  ADD COLUMN "temperatura" DECIMAL(5,2),
  ADD COLUMN "termografo" TEXT;
