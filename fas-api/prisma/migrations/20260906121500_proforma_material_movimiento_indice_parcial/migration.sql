-- Reemplaza la unicidad incondicional de movimientoId por un índice parcial:
-- a lo más una ProformaMaterial NO ANULADA por Movimiento (R25) — una vez
-- ANULADA, el Movimiento queda libre para una nueva Proforma. Mismo patrón
-- que "recepciones_ordenCompraId_activa_key" (Recepcion.ordenCompraId).

-- DropIndex
DROP INDEX "proformas_material_empresaId_movimientoId_key";

-- DropIndex
DROP INDEX "proformas_material_movimientoId_key";

-- CreateIndex
CREATE INDEX "proformas_material_movimientoId_idx" ON "proformas_material"("movimientoId");

-- CreateIndex (parcial, no representable en el DSL de Prisma)
CREATE UNIQUE INDEX "proformas_material_movimiento_activa_key" ON "proformas_material"("empresaId", "movimientoId") WHERE "estado" <> 'ANULADA';
