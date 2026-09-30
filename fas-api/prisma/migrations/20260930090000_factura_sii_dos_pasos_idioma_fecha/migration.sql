-- Facturación Exportación fase 1: firma SII en dos pasos, idioma y fecha
-- editables, XML del DTE.

-- Proforma: fecha del documento editable.
ALTER TABLE "proformas" ADD COLUMN "fechaDocumento" TIMESTAMP(3);

-- DocumentoDte: XML timbrado para descarga.
ALTER TABLE "documentos_dte" ADD COLUMN "xml" TEXT;

-- FacturaExportacion: idioma, fecha del documento, motivo de rechazo SII.
ALTER TABLE "facturas_exportacion" ADD COLUMN "idioma" TEXT NOT NULL DEFAULT 'EN';
ALTER TABLE "facturas_exportacion" ADD COLUMN "fechaDocumento" TIMESTAMP(3);
ALTER TABLE "facturas_exportacion" ADD COLUMN "errorMensajeSii" TEXT;

-- Estado: EMITIDA -> APROBADA; agrega RECHAZADA. Se recrea el enum para dejarlo
-- limpio (Postgres no permite quitar valores de un enum in-place).
ALTER TYPE "EstadoFacturaExportacion" RENAME TO "EstadoFacturaExportacion_old";
CREATE TYPE "EstadoFacturaExportacion" AS ENUM ('BORRADOR', 'APROBADA', 'RECHAZADA', 'ANULADA');
ALTER TABLE "facturas_exportacion" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "facturas_exportacion"
  ALTER COLUMN "estado" TYPE "EstadoFacturaExportacion"
  USING (
    CASE "estado"::text
      WHEN 'EMITIDA' THEN 'APROBADA'
      ELSE "estado"::text
    END
  )::"EstadoFacturaExportacion";
ALTER TABLE "facturas_exportacion" ALTER COLUMN "estado" SET DEFAULT 'BORRADOR';
DROP TYPE "EstadoFacturaExportacion_old";

-- Backfill: las facturas ya timbradas (fecha de emisión presente) toman esa
-- fecha como fecha del documento.
UPDATE "facturas_exportacion" SET "fechaDocumento" = "fechaEmision" WHERE "fechaEmision" IS NOT NULL;
