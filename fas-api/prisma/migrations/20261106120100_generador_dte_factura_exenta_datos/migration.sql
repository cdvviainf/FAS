-- Backfill: las Facturas Nacionales que quedaron como 34 (todas sus líneas
-- exentas) pasan a la clase FACTURA_NACIONAL_EXENTA.
UPDATE "documentos_manuales"
SET "claseDocumento" = 'FACTURA_NACIONAL_EXENTA'
WHERE "claseDocumento" = 'FACTURA_NACIONAL' AND "tipoDte" = 34;

-- Las líneas quedan coherentes con la clase: exentas solo en la Factura Exenta.
-- Documentos ya timbrados no se tocan (fase 1 solo tiene BORRADOR/ANULADA).
UPDATE "documento_manual_lineas" l
SET "exento" = (d."claseDocumento" = 'FACTURA_NACIONAL_EXENTA')
FROM "documentos_manuales" d
WHERE l."documentoManualId" = d."id" AND d."estado" = 'BORRADOR';

-- Recalcular montos de los borradores cuyas líneas cambiaron de condición
-- (Facturas 33 que tenían líneas exentas sueltas, Guías/NC/ND con exentos).
WITH tot AS (
  SELECT d."id",
         COALESCE(SUM(CASE WHEN l."exento" THEN 0 ELSE l."montoLinea" END), 0) AS neto,
         COALESCE(SUM(CASE WHEN l."exento" THEN l."montoLinea" ELSE 0 END), 0) AS exento
  FROM "documentos_manuales" d
  LEFT JOIN "documento_manual_lineas" l ON l."documentoManualId" = d."id"
  WHERE d."estado" = 'BORRADOR'
  GROUP BY d."id"
)
UPDATE "documentos_manuales" d
SET "montoNeto" = tot.neto,
    "montoExento" = tot.exento,
    "montoIva" = ROUND(tot.neto * 0.19),
    "montoTotal" = tot.neto + ROUND(tot.neto * 0.19) + tot.exento
FROM tot
WHERE d."id" = tot."id";
