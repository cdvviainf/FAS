-- At most one non-deleted temporada can be predeterminada=true (PostgreSQL partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS ux_temporadas_una_predeterminada
  ON temporadas (predeterminada)
  WHERE predeterminada = true AND "eliminadoEn" IS NULL;
