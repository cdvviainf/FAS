-- Tipo de inspección (solo informativo) en la Solicitud de Inspección:
-- Producto Terminado o Proceso. Nullable (las existentes quedan sin valor).
CREATE TYPE "TipoInspeccionSolicitud" AS ENUM ('PRODUCTO_TERMINADO', 'PROCESO');
ALTER TABLE "solicitudes_inspeccion" ADD COLUMN "tipoInspeccion" "TipoInspeccionSolicitud";
