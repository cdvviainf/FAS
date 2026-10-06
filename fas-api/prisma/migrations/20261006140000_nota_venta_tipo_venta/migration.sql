-- 2026-10-06 · Cierre Comercial: Tipo de Venta (Exportación / Nacional)
-- El DEFAULT 'EXPORTACION' backfillea las filas existentes (hoy todo es export).
CREATE TYPE "TipoVenta" AS ENUM ('EXPORTACION', 'NACIONAL');

ALTER TABLE "notas_venta" ADD COLUMN "tipoVenta" "TipoVenta" NOT NULL DEFAULT 'EXPORTACION';
