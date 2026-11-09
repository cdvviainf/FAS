-- Temporada OBLIGATORIA en todo registro (2026-11-09).
-- Tablas: notas_venta, ordenes_compra, instructivos_embalaje, recepciones,
-- reclamos y movimientos_cuenta_corriente.
--
-- Backfill de registros sin temporada (misma regla que resolverTemporadaPorFecha
-- + respaldo): 1) la temporada de SU empresa cuyo rango contiene la fecha del
-- documento (inicio más reciente si se solapan); 2) la predeterminada de su
-- empresa; 3) la temporada más reciente de su empresa. Reclamos heredan antes
-- la temporada del Cierre de su Embarque. Si una empresa con registros no tiene
-- NINGUNA temporada, la migración falla con un mensaje explícito: crear una
-- temporada en esa empresa y reintentar.

-- reclamos / movimientos no tenían FK: limpiar valores que no apunten a una
-- temporada de la MISMA empresa (se recalculan con el backfill).
UPDATE "reclamos" n SET "temporadaId" = NULL
WHERE n."temporadaId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "temporadas" t WHERE t."id" = n."temporadaId" AND t."empresaId" = n."empresaId");
UPDATE "movimientos_cuenta_corriente" n SET "temporadaId" = NULL
WHERE n."temporadaId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "temporadas" t WHERE t."id" = n."temporadaId" AND t."empresaId" = n."empresaId");

-- notas_venta
UPDATE "notas_venta" n SET "temporadaId" = COALESCE(
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL
      AND t."fechaInicio" <= n."fecha"::date AND t."fechaTermino" >= n."fecha"::date
    ORDER BY t."fechaInicio" DESC, t."id" DESC LIMIT 1),
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."predeterminada" = true
    ORDER BY t."id" DESC LIMIT 1),
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId"
    ORDER BY (t."eliminadoEn" IS NULL) DESC, t."fechaInicio" DESC, t."id" DESC LIMIT 1)
)
WHERE n."temporadaId" IS NULL;

-- ordenes_compra
UPDATE "ordenes_compra" n SET "temporadaId" = COALESCE(
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL
      AND t."fechaInicio" <= n."fecha"::date AND t."fechaTermino" >= n."fecha"::date
    ORDER BY t."fechaInicio" DESC, t."id" DESC LIMIT 1),
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."predeterminada" = true
    ORDER BY t."id" DESC LIMIT 1),
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId"
    ORDER BY (t."eliminadoEn" IS NULL) DESC, t."fechaInicio" DESC, t."id" DESC LIMIT 1)
)
WHERE n."temporadaId" IS NULL;

-- instructivos_embalaje
UPDATE "instructivos_embalaje" n SET "temporadaId" = COALESCE(
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL
      AND t."fechaInicio" <= n."fechaInicioPrograma"::date AND t."fechaTermino" >= n."fechaInicioPrograma"::date
    ORDER BY t."fechaInicio" DESC, t."id" DESC LIMIT 1),
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."predeterminada" = true
    ORDER BY t."id" DESC LIMIT 1),
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId"
    ORDER BY (t."eliminadoEn" IS NULL) DESC, t."fechaInicio" DESC, t."id" DESC LIMIT 1)
)
WHERE n."temporadaId" IS NULL;

-- recepciones
UPDATE "recepciones" n SET "temporadaId" = COALESCE(
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL
      AND t."fechaInicio" <= n."creadoEn"::date AND t."fechaTermino" >= n."creadoEn"::date
    ORDER BY t."fechaInicio" DESC, t."id" DESC LIMIT 1),
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."predeterminada" = true
    ORDER BY t."id" DESC LIMIT 1),
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId"
    ORDER BY (t."eliminadoEn" IS NULL) DESC, t."fechaInicio" DESC, t."id" DESC LIMIT 1)
)
WHERE n."temporadaId" IS NULL;

-- reclamos: primero la temporada del Cierre del Embarque (notas_venta ya completadas).
UPDATE "reclamos" n SET "temporadaId" = nv."temporadaId"
FROM "embarques" e JOIN "notas_venta" nv ON nv."id" = e."notaVentaId"
WHERE n."temporadaId" IS NULL AND e."id" = n."embarqueId" AND nv."empresaId" = n."empresaId";

-- reclamos
UPDATE "reclamos" n SET "temporadaId" = COALESCE(
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL
      AND t."fechaInicio" <= n."fechaReclamo"::date AND t."fechaTermino" >= n."fechaReclamo"::date
    ORDER BY t."fechaInicio" DESC, t."id" DESC LIMIT 1),
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."predeterminada" = true
    ORDER BY t."id" DESC LIMIT 1),
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId"
    ORDER BY (t."eliminadoEn" IS NULL) DESC, t."fechaInicio" DESC, t."id" DESC LIMIT 1)
)
WHERE n."temporadaId" IS NULL;

-- movimientos_cuenta_corriente
UPDATE "movimientos_cuenta_corriente" n SET "temporadaId" = COALESCE(
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL
      AND t."fechaInicio" <= n."fecha"::date AND t."fechaTermino" >= n."fecha"::date
    ORDER BY t."fechaInicio" DESC, t."id" DESC LIMIT 1),
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."predeterminada" = true
    ORDER BY t."id" DESC LIMIT 1),
  (SELECT t."id" FROM "temporadas" t
    WHERE t."empresaId" = n."empresaId"
    ORDER BY (t."eliminadoEn" IS NULL) DESC, t."fechaInicio" DESC, t."id" DESC LIMIT 1)
)
WHERE n."temporadaId" IS NULL;

DO $$
DECLARE
  tabla text;
  pendientes integer;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['notas_venta','ordenes_compra','instructivos_embalaje','recepciones','reclamos','movimientos_cuenta_corriente'] LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE "temporadaId" IS NULL', tabla) INTO pendientes;
    IF pendientes > 0 THEN
      RAISE EXCEPTION 'Temporada obligatoria: % registro(s) de % no tienen temporada porque su empresa no tiene temporadas. Crea una temporada en esa empresa y vuelve a ejecutar la migración.', pendientes, tabla;
    END IF;
  END LOOP;
END $$;

ALTER TABLE "notas_venta" ALTER COLUMN "temporadaId" SET NOT NULL;
ALTER TABLE "ordenes_compra" ALTER COLUMN "temporadaId" SET NOT NULL;
ALTER TABLE "instructivos_embalaje" ALTER COLUMN "temporadaId" SET NOT NULL;
ALTER TABLE "recepciones" ALTER COLUMN "temporadaId" SET NOT NULL;
ALTER TABLE "reclamos" ALTER COLUMN "temporadaId" SET NOT NULL;
ALTER TABLE "movimientos_cuenta_corriente" ALTER COLUMN "temporadaId" SET NOT NULL;

-- FK compuesta (empresaId, temporadaId) -> temporadas(empresaId, id) en las
-- dos tablas que no la tenían (mismo patrón que 20261106150000).
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_empresaId_temporadaId_fkey" FOREIGN KEY ("empresaId", "temporadaId") REFERENCES "temporadas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_cuenta_corriente" ADD CONSTRAINT "movimientos_cuenta_corriente_empresaId_temporadaId_fkey" FOREIGN KEY ("empresaId", "temporadaId") REFERENCES "temporadas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
