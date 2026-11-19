-- InstructivoHijo: `codigo` único solo entre filas ACTIVAS (2026-11-19).
-- Al anular una carga/despacho y volver a generar instructivos, la secuencia
-- se reutiliza (sale "-1" otra vez, no "-2"), así que el código de una fila
-- soft-deleted puede repetirse. Prisma no soporta índices parciales en el DSL
-- (mismo patrón que instructivos_hijos_empresa_embarque_planta_activo_key).
DROP INDEX IF EXISTS "instructivos_hijos_empresaId_codigo_key";

CREATE UNIQUE INDEX "instructivos_hijos_empresa_codigo_activo_key" ON "instructivos_hijos"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
