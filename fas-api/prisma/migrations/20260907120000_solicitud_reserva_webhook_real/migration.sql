-- Contrato real del webhook AGL360 -> FAS (Docs/webhook-fas.md): guarda el
-- id de Orden/Solicitud de Servicio de AGL360 y su estado inicial. Los
-- campos de detalle de booking (numeroBooking/naviera/nave/...) ya existían
-- y quedan igual — este evento nunca los puebla, se dejan para cuando exista
-- un endpoint de consulta.
ALTER TABLE "solicitudes_reserva"
  ADD COLUMN "idOrdenServicioAgl" INTEGER,
  ADD COLUMN "idSolicitudServicioAgl" INTEGER,
  ADD COLUMN "estadoOrdenAgl" TEXT;
