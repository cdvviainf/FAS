-- Guía de Despacho emitida por un tercero (2026-10-12): cuando NO emitimos
-- nosotros el DTE 52, se registra el número de la Guía de quien la emitió
-- (Entidad tipo PRODUCTOR o PLANTA). Excluyente con la Guía propia
-- (documentos_dte origenTipo='embarque'), enforcement en el service.
ALTER TABLE "embarques" ADD COLUMN "guiaExternaNumero" TEXT;
ALTER TABLE "embarques" ADD COLUMN "guiaExternaEmisorId" INTEGER;
ALTER TABLE "embarques" ADD COLUMN "guiaExternaFecha" TIMESTAMP(3);

CREATE INDEX "embarques_guiaExternaEmisorId_idx" ON "embarques"("guiaExternaEmisorId");

ALTER TABLE "embarques" ADD CONSTRAINT "embarques_empresaId_guiaExternaEmisorId_fkey" FOREIGN KEY ("empresaId", "guiaExternaEmisorId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Duplicidad "mismo emisor + mismo número de guía" por empresa: un emisor no
-- puede repetir el mismo número de guía en dos embarques. Índice único parcial
-- (solo filas con guía externa registrada), mismo patrón que el resto del schema.
CREATE UNIQUE INDEX "embarques_empresa_guia_externa_emisor_numero_key" ON "embarques"("empresaId", "guiaExternaEmisorId", "guiaExternaNumero") WHERE "guiaExternaNumero" IS NOT NULL;
