-- Índices únicos parciales lote 2: codigo único entre registros no eliminados (R2 / DoD-02)
-- Aplica a los 10 mantenedores relacionados (con FK).
-- Prisma no soporta WHERE en @@unique, por eso se crean con SQL directo.

CREATE UNIQUE INDEX IF NOT EXISTS "ux_regiones_codigo"
  ON "regiones" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_especies_codigo"
  ON "especies" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_provincias_codigo"
  ON "provincias" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_comunas_codigo"
  ON "comunas" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_grupos_variedad_codigo"
  ON "grupos_variedad" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_variedades_codigo"
  ON "variedades" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_categorias_codigo"
  ON "categorias" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_calibres_codigo"
  ON "calibres" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_parametros_codigo"
  ON "parametros" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_mercados_codigo"
  ON "mercados" ("codigo")
  WHERE "eliminadoEn" IS NULL;

-- Índices únicos parciales R6/R7: (especieId, orden) único por especie entre no eliminados
CREATE UNIQUE INDEX IF NOT EXISTS "ux_categorias_especie_orden"
  ON "categorias" ("especieId", "orden")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_calibres_especie_orden"
  ON "calibres" ("especieId", "orden")
  WHERE "eliminadoEn" IS NULL;
