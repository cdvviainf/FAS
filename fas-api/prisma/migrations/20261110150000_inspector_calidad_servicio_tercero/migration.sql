-- Cierre de inspección en dos pasos + Inspector Calidad + Servicio Tercero (2026-11-10).
ALTER TABLE "usuarios" ADD COLUMN "esInspectorCalidad" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "solicitudes_inspeccion" ADD COLUMN "servicioTercero" TEXT;

-- "Características de Madurez" pasa a llamarse "Indicadores de Madurez".
UPDATE "items_menu" SET "nombre" = 'Indicadores de Madurez' WHERE "codigo" = 'CONFIG_CARACTERISTICAS_MADUREZ';
