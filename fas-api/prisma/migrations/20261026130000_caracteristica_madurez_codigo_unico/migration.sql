-- CM-005: índice único parcial de código activo por empresa (patrón de todos
-- los mantenedores). Protege contra códigos duplicados en creaciones
-- concurrentes, que la comprobación previa del servicio no cubre.
CREATE UNIQUE INDEX "caracteristicas_madurez_empresa_codigo_activo_key"
  ON "caracteristicas_madurez"("empresaId", "codigo")
  WHERE "eliminadoEn" IS NULL;
