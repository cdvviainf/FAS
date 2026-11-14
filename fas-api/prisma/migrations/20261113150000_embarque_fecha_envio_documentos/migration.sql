-- Fecha de envío de documentos del Embarque: fecha base de las cuotas con
-- referencia ENVIO_DOCUMENTOS (vencimiento en Factura de Exportación/cobranza).
ALTER TABLE "embarques" ADD COLUMN "fechaEnvioDocumentos" TIMESTAMP(3);
