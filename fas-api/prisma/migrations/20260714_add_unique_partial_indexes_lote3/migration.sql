-- Índices únicos parciales lote 3: Puerto, Moneda, ConceptoCtaCte
-- codigo único entre registros no eliminados (R2 / DoD-02)

CREATE UNIQUE INDEX IF NOT EXISTS "ux_puertos_codigo"
  ON "puertos" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_monedas_codigo"
  ON "monedas" ("codigo")
  WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_conceptos_cta_cte_codigo"
  ON "conceptos_cta_cte" ("codigo")
  WHERE "eliminadoEn" IS NULL;
