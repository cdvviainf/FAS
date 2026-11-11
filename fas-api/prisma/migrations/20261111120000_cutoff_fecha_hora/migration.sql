-- Cutoff pasa de "solo fecha" a fecha y hora (2026-11-11). La columna ya es
-- TIMESTAMP(3) (UTC); los valores capturados como fecha quedaron en 00:00 UTC,
-- que en Chile se vería como el día anterior a las 21:00. Se llevan a la
-- medianoche de Chile del mismo día (respeta horario de verano/invierno).
UPDATE "embarques"
SET "cutoffDate" = ("cutoffDate"::date::timestamp AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC'
WHERE "cutoffDate" IS NOT NULL
  AND "cutoffDate" = date_trunc('day', "cutoffDate");
