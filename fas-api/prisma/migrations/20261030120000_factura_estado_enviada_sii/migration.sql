-- Estado intermedio ENVIADA_SII para Facturas (timbrada con folio pero sin
-- veredicto confirmado del SII). El veredicto real se reconcilia on-demand.
ALTER TYPE "EstadoFacturaExportacion" ADD VALUE IF NOT EXISTS 'ENVIADA_SII' BEFORE 'APROBADA';
ALTER TYPE "EstadoFacturaNacional" ADD VALUE IF NOT EXISTS 'ENVIADA_SII' BEFORE 'APROBADA';
