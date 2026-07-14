-- Unique partial indexes for Lote 4 mantenedores: codigo between non-deleted records (R2/DoD-02)
CREATE UNIQUE INDEX IF NOT EXISTS ux_temporadas_codigo ON temporadas (codigo) WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_bodegas_codigo ON bodegas (codigo) WHERE "eliminadoEn" IS NULL;