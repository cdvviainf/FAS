-- Fase 4a: garantiza a nivel de BD las invariantes "maximo una direccion
-- principal" y "maximo un representante legal" por empresa -- mismo patron
-- que ux_entidad_direcciones_por_defecto / ux_entidad_contactos_representante
-- (20260722000001_ent_enum_fields_indexes). El servicio ya aplica esto en el
-- caso feliz; el indice cierra la ventana de carrera entre dos requests
-- concurrentes marcando la misma bandera en paralelo.

-- Self-safe: resuelve duplicados preexistentes antes de crear el indice
-- (conserva el de menor id, desmarca el resto) para no romper el deploy si
-- alguna fila ya quedo inconsistente.
WITH duplicados AS (
  SELECT id, "empresaId",
    ROW_NUMBER() OVER (PARTITION BY "empresaId" ORDER BY id) AS rn
  FROM "empresa_direcciones"
  WHERE "eliminadoEn" IS NULL AND "esPorDefecto" = true
)
UPDATE "empresa_direcciones" ed
SET "esPorDefecto" = false
FROM duplicados d
WHERE ed.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_empresa_direcciones_por_defecto"
  ON "empresa_direcciones"("empresaId") WHERE "eliminadoEn" IS NULL AND "esPorDefecto" = true;

WITH duplicados AS (
  SELECT id, "empresaId",
    ROW_NUMBER() OVER (PARTITION BY "empresaId" ORDER BY id) AS rn
  FROM "empresa_contactos"
  WHERE "eliminadoEn" IS NULL AND "esRepresentanteLegal" = true
)
UPDATE "empresa_contactos" ec
SET "esRepresentanteLegal" = false
FROM duplicados d
WHERE ec.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_empresa_contactos_representante"
  ON "empresa_contactos"("empresaId") WHERE "eliminadoEn" IS NULL AND "esRepresentanteLegal" = true;
