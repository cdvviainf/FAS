-- FAS-DTE110-R1-001 (2026-10-13): invalida los borradores temporales
-- (TEMPORAL_CREADO) de Facturas de Exportación creados ANTES de esta mejora. Su
-- payload en LibreDTE no trae los campos nuevos del DTE 110 (FmaPago, FmaPagExp,
-- DirRecep, referencia del Instructivo). Al borrarlos, "Firmar" vuelve a exigir
-- reenviar el borrador — que reconstruye el payload con los campos nuevos y
-- revalida FmaPagExp. No se tocan los DTE ya timbrados (GENERADO): solo los
-- borradores no terminales (mismo criterio que descartar un borrador al reeemitir).
DELETE FROM "documentos_dte"
WHERE "origenTipo" = 'factura-exportacion'
  AND "estado" IN ('TEMPORAL_CREADO', 'PENDIENTE', 'EMITIENDO', 'ERROR');
