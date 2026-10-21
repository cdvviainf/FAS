-- Sello/precinto del contenedor para el bloque Aduana del DTE de exportación
-- (SII: TipoBultos.Sello junto a IdContainer). EmisorSello se deriva de la
-- naviera, no se persiste aparte. Columnas aditivas y nullables.

ALTER TABLE "embarques" ADD COLUMN "numeroSelloManual" TEXT;

ALTER TABLE "solicitudes_reserva" ADD COLUMN "numeroSello" TEXT;
