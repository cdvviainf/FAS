-- Mantenedor de cajas teóricas por (embalaje, tipo de pallet).

-- Target de la FK compuesta (empresaId, tipoPalletId).
CREATE UNIQUE INDEX IF NOT EXISTS "tipos_pallet_empresaId_id_key" ON "tipos_pallet"("empresaId", "id");

CREATE TABLE "cajas_por_pallet" (
  "id" SERIAL NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "articuloId" INTEGER NOT NULL,
  "tipoPalletId" INTEGER NOT NULL,
  "cajasPorPallet" INTEGER NOT NULL,
  "bloqueado" BOOLEAN NOT NULL DEFAULT false,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creadoPor" TEXT NOT NULL,
  "actualizadoEn" TIMESTAMP(3),
  "actualizadoPor" TEXT,
  "eliminadoEn" TIMESTAMP(3),
  "eliminadoPor" TEXT,
  CONSTRAINT "cajas_por_pallet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cajas_por_pallet_empresaId_idx" ON "cajas_por_pallet"("empresaId");

-- Unicidad del par (empresa, embalaje, tipo de pallet) entre filas activas.
CREATE UNIQUE INDEX "cajas_por_pallet_empresa_articulo_tipopallet_activo_key"
  ON "cajas_por_pallet"("empresaId", "articuloId", "tipoPalletId") WHERE "eliminadoEn" IS NULL;

ALTER TABLE "cajas_por_pallet"
  ADD CONSTRAINT "cajas_por_pallet_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cajas_por_pallet"
  ADD CONSTRAINT "cajas_por_pallet_empresaId_articuloId_fkey"
  FOREIGN KEY ("empresaId", "articuloId") REFERENCES "articulos"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cajas_por_pallet"
  ADD CONSTRAINT "cajas_por_pallet_empresaId_tipoPalletId_fkey"
  FOREIGN KEY ("empresaId", "tipoPalletId") REFERENCES "tipos_pallet"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
