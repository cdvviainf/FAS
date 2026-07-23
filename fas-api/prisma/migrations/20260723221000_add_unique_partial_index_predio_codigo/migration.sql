-- Predio.codigo único por productor entre no eliminados (R2)
CREATE UNIQUE INDEX IF NOT EXISTS ux_predios_entidad_codigo
  ON predios ("entidadId", codigo)
  WHERE "eliminadoEn" IS NULL;
