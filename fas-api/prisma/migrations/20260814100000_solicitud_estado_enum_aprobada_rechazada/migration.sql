-- AlterEnum: agrega APROBADA y RECHAZADA (CERRADA se mantiene en el tipo —
-- Postgres no permite eliminar valores de un enum sin recrear el tipo — pero
-- la aplicación deja de escribirlo desde este cambio).
--
-- Separado de la migración siguiente a propósito: Postgres no permite usar
-- un valor de enum recién agregado dentro de la misma transacción en que se
-- agregó (y Prisma Migrate aplica cada migration.sql en una transacción).
ALTER TYPE "EstadoSolicitudInspeccion" ADD VALUE 'APROBADA';
ALTER TYPE "EstadoSolicitudInspeccion" ADD VALUE 'RECHAZADA';
