-- Índices únicos parciales: codigo único entre registros no eliminados (R2 / DoD-02)
-- Prisma no soporta WHERE en @@unique, por eso se crean con SQL directo.

CREATE UNIQUE INDEX "paises_codigo_activo_idx"
  ON "paises" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX "zonas_codigo_activo_idx"
  ON "zonas" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX "grupos_mercado_codigo_activo_idx"
  ON "grupos_mercado" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX "tipos_embarque_codigo_activo_idx"
  ON "tipos_embarque" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX "unidades_medida_codigo_activo_idx"
  ON "unidades_medida" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX "tipos_pallet_codigo_activo_idx"
  ON "tipos_pallet" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX "alturas_codigo_activo_idx"
  ON "alturas" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX "tipos_produccion_codigo_activo_idx"
  ON "tipos_produccion" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX "tipos_defecto_codigo_activo_idx"
  ON "tipos_defecto" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX "tipos_parametro_codigo_activo_idx"
  ON "tipos_parametro" ("codigo")
  WHERE "eliminadoEn" IS NULL;
