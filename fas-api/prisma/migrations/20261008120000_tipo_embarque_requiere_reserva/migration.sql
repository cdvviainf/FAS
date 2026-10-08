-- TipoEmbarque: flag "requiereReserva" (2026-10-08).
-- La Solicitud de Reserva (booking logístico, p.ej. AGL360) solo aplica a
-- Aéreo y Marítimo; Terrestre no reserva espacio.
ALTER TABLE "tipos_embarque" ADD COLUMN "requiereReserva" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: los tipos estándar Aéreo y Marítimo requieren reserva.
UPDATE "tipos_embarque" SET "requiereReserva" = true WHERE "codigo" IN ('MARITIMO', 'AEREO');
