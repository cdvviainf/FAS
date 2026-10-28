-- Cobranza — Nota de Crédito: a lo más UNA NC activa por factura (FAS-COB-NC-R1-001).
-- Backstop a nivel BD contra una carrera de "anular-con-nc" (dos NC/folios para
-- la misma factura). Índices únicos PARCIALES (solo filas no eliminadas); los
-- NULL de la FK no usada del modelo polimórfico no colisionan entre sí.
CREATE UNIQUE INDEX "notas_credito_facturaExportacionId_activa_key"
  ON "notas_credito"("facturaExportacionId")
  WHERE "eliminadoEn" IS NULL AND "facturaExportacionId" IS NOT NULL;

CREATE UNIQUE INDEX "notas_credito_facturaNacionalId_activa_key"
  ON "notas_credito"("facturaNacionalId")
  WHERE "eliminadoEn" IS NULL AND "facturaNacionalId" IS NOT NULL;
