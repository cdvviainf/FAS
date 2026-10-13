-- Termógrafo(s) del Packing List (2026-10-12): columna opcional del formato de
-- carga del despacho. Un contenedor puede llevar más de uno; se guardan los
-- valores distintos no vacíos leídos del Excel. Array JSON por archivo.
ALTER TABLE "embarque_packing_lists" ADD COLUMN "termografos" JSONB NOT NULL DEFAULT '[]';
