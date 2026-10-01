-- Tipo de Reclamo (2026-10-01): mantenedor propio con el flag
-- generaAnalisisCalidad. Mismo patrón que ClausulaVenta.

-- 1. Tabla.
CREATE TABLE "tipos_reclamo" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "descripcionExtranjera" TEXT,
    "generaAnalisisCalidad" BOOLEAN NOT NULL DEFAULT false,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "tipos_reclamo_pkey" PRIMARY KEY ("id")
);

-- 2. Índices. @@unique([empresaId, id]) + índice por empresa.
CREATE UNIQUE INDEX "tipos_reclamo_empresaId_id_key" ON "tipos_reclamo"("empresaId", "id");
CREATE INDEX "tipos_reclamo_empresaId_idx" ON "tipos_reclamo"("empresaId");
-- Unicidad de código entre registros activos (mismo patrón que clausulas_venta).
CREATE UNIQUE INDEX "tipos_reclamo_empresa_codigo_activo_key" ON "tipos_reclamo"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;

-- 3. FK a Empresa.
ALTER TABLE "tipos_reclamo" ADD CONSTRAINT "tipos_reclamo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. FK en Reclamo: tipoReclamoId (nullable) -> tipos_reclamo(empresaId, id).
ALTER TABLE "reclamos" ADD COLUMN "tipoReclamoId" INTEGER;
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_empresaId_tipoReclamoId_fkey" FOREIGN KEY ("empresaId", "tipoReclamoId") REFERENCES "tipos_reclamo"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
