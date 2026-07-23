-- Índice único parcial: codigo único entre no eliminados (regla G2)
CREATE UNIQUE INDEX IF NOT EXISTS ux_motivos_inspeccion_codigo
  ON motivos_inspeccion (codigo)
  WHERE "eliminadoEn" IS NULL;
