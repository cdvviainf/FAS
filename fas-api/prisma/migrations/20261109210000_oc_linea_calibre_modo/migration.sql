-- OC de fruta (2026-11-09): presentación de calibres en el PDF por línea
-- ("desde – hasta" o específicos), igual que el Cierre Comercial. Las líneas
-- existentes tomadas de un Cierre heredan la opción de esa línea.
ALTER TABLE "orden_compra_linea" ADD COLUMN "calibreModo" "CalibreModo" NOT NULL DEFAULT 'ESPECIFICOS';

UPDATE "orden_compra_linea" l
SET "calibreModo" = d."calibreModo"
FROM "notas_venta_detalle" d
WHERE d.id = l."notaVentaDetalleId";
