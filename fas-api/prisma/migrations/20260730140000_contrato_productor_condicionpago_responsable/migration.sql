-- condicionPagoId era un Int suelto sin FK real (apuntaba conceptualmente a
-- Parametro, nunca llegó a tener catálogo). Antes de agregar la FK real a
-- CondicionPago, se limpian valores existentes que no correspondan a un
-- CondicionPago válido (decisión de negocio, Christian, 2026-07-30).
UPDATE "productor_contratos" pc
SET "condicionPagoId" = NULL
WHERE pc."condicionPagoId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "condiciones_pago" cp WHERE cp.id = pc."condicionPagoId");

-- AlterTable
ALTER TABLE "productor_contratos" ADD COLUMN "responsableId" TEXT;

-- AddForeignKey
ALTER TABLE "productor_contratos" ADD CONSTRAINT "productor_contratos_condicionPagoId_fkey" FOREIGN KEY ("condicionPagoId") REFERENCES "condiciones_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contratos" ADD CONSTRAINT "productor_contratos_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "productor_contratos_responsableId_idx" ON "productor_contratos"("responsableId");
