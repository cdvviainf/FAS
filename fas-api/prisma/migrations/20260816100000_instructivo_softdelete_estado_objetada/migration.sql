-- Instructivo de Embalaje gana soft-delete (paridad con el resto de
-- documentos de Compras — nunca DELETE físico, CLAUDE.md §12 regla 8).
ALTER TABLE "instructivos_embalaje" ADD COLUMN "eliminadoEn" TIMESTAMP(3);
ALTER TABLE "instructivos_embalaje" ADD COLUMN "eliminadoPor" TEXT;

-- Nuevo veredicto de cierre para Solicitud de Inspección: OBJETADA (terminal,
-- mismo tratamiento que RECHAZADA). No se usa en ningún UPDATE/INSERT dentro
-- de esta misma migración, así que no aplica la limitación de Postgres de
-- usar un valor de enum recién agregado en la misma transacción.
ALTER TYPE "EstadoSolicitudInspeccion" ADD VALUE 'OBJETADA';
