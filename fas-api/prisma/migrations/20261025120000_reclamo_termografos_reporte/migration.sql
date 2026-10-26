-- Reclamo: datos de contexto capturados al ingresar desde Ventas (2026-10-25).
-- "Días desde la recepción hasta la notificación" NO se persiste (se deriva en
-- la respuesta del detalle: fechaReclamo − Embarque.fechaArribo).
ALTER TABLE "reclamos"
  ADD COLUMN "tieneTermografos" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tieneReporte" BOOLEAN NOT NULL DEFAULT false;
