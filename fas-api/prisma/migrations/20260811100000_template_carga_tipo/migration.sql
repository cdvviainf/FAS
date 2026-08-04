-- Introduce el discriminador `tipo` en TemplateCarga (RECEPCION, PACKING_LIST,
-- y los que se agreguen despues -- whitelist en codigo, no enum Prisma, mismo
-- criterio que `campo` en templates_carga_campos). Hasta ahora TemplateCarga
-- solo se usaba para el Excel de Recepcion de Fruta.

-- Self-safe: se agrega nullable, se backfillea todo lo existente a
-- 'RECEPCION' (el unico tipo que existia hasta ahora) y recien despues se
-- exige NOT NULL -- mismo patron usado en toda la Fase 3/4 de multi-empresa.
ALTER TABLE "templates_carga" ADD COLUMN "tipo" TEXT;

UPDATE "templates_carga" SET "tipo" = 'RECEPCION' WHERE "tipo" IS NULL;

ALTER TABLE "templates_carga" ALTER COLUMN "tipo" SET NOT NULL;
