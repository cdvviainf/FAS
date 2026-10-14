-- DTE110-CUOTAS-001 (2026-10-13): invalida de nuevo los borradores temporales
-- (no terminales) de Facturas de Exportación. Un temporal creado ANTES de esta
-- mejora conserva en LibreDTE el payload viejo SIN la programación de pagos
-- (IdDoc.MntPagos/FchVenc) y CON el FmaPagExp retirado; "Firmar" lo timbraría
-- tal cual sin reconstruir el payload. Al borrarlos, "Firmar" vuelve a exigir
-- reenviar el borrador, que reconstruye el payload con MntPagos y sin FmaPagExp.
-- No se tocan los DTE ya timbrados (GENERADO): solo los borradores no terminales.
DELETE FROM "documentos_dte"
WHERE "origenTipo" = 'factura-exportacion'
  AND "estado" IN ('TEMPORAL_CREADO', 'PENDIENTE', 'EMITIENDO', 'ERROR');
