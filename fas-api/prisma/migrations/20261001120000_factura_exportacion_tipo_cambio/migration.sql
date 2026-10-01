-- Tipo de cambio en la Factura de Exportación (DTE 110): el SII/LibreDTE exige
-- la paridad peso/moneda extranjera para expresar el equivalente en pesos
-- (Encabezado.OtraMoneda). Se trae del dólar/euro observado del Banco Central
-- (vía mindicador.cl) al crear el borrador; editable en BORRADOR.
-- fechaTipoCambio = fecha de la paridad observada (trazabilidad).
ALTER TABLE "facturas_exportacion"
  ADD COLUMN "tipoCambio" DECIMAL(14,4),
  ADD COLUMN "fechaTipoCambio" TIMESTAMP(3);
