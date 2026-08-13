-- Instructivo de Embalaje: reemplaza notaVentaId por entidadProductorId +
-- grupoMercadoId + fechaInicioPrograma (obligatorios) + observaciones
-- (opcional). Destructivo: no hay forma de derivar un productor desde la NV
-- existente (sistema en desarrollo, sin datos transaccionales reales — mismo
-- criterio aceptado en todo el proyecto).
ALTER TABLE "instructivos_embalaje" DROP CONSTRAINT "instructivos_embalaje_empresaId_notaVentaId_fkey";
DROP INDEX "instructivos_embalaje_notaVentaId_idx";
ALTER TABLE "instructivos_embalaje" DROP COLUMN "notaVentaId";

ALTER TABLE "instructivos_embalaje" ADD COLUMN "entidadProductorId" INTEGER NOT NULL;
ALTER TABLE "instructivos_embalaje" ADD COLUMN "grupoMercadoId" INTEGER NOT NULL;
ALTER TABLE "instructivos_embalaje" ADD COLUMN "fechaInicioPrograma" TIMESTAMP(3) NOT NULL;
ALTER TABLE "instructivos_embalaje" ADD COLUMN "observaciones" TEXT;

CREATE INDEX "instructivos_embalaje_entidadProductorId_idx" ON "instructivos_embalaje"("entidadProductorId");
CREATE INDEX "instructivos_embalaje_grupoMercadoId_idx" ON "instructivos_embalaje"("grupoMercadoId");

ALTER TABLE "instructivos_embalaje" ADD CONSTRAINT "instructivos_embalaje_empresaId_entidadProductorId_fkey" FOREIGN KEY ("empresaId", "entidadProductorId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instructivos_embalaje" ADD CONSTRAINT "instructivos_embalaje_empresaId_grupoMercadoId_fkey" FOREIGN KEY ("empresaId", "grupoMercadoId") REFERENCES "grupos_mercado"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Línea de detalle: altura de pallet (obligatoria) + variedad rotulada
-- (opcional, segunda variedad de la misma especie).
ALTER TABLE "instructivo_embalaje_detalle" ADD COLUMN "alturaId" INTEGER NOT NULL;
ALTER TABLE "instructivo_embalaje_detalle" ADD COLUMN "variedadRotuladaId" INTEGER;

CREATE INDEX "instructivo_embalaje_detalle_alturaId_idx" ON "instructivo_embalaje_detalle"("alturaId");
CREATE INDEX "instructivo_embalaje_detalle_variedadRotuladaId_idx" ON "instructivo_embalaje_detalle"("variedadRotuladaId");

ALTER TABLE "instructivo_embalaje_detalle" ADD CONSTRAINT "instructivo_embalaje_detalle_alturaId_fkey" FOREIGN KEY ("alturaId") REFERENCES "alturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instructivo_embalaje_detalle" ADD CONSTRAINT "instructivo_embalaje_detalle_variedadRotuladaId_fkey" FOREIGN KEY ("variedadRotuladaId") REFERENCES "variedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Orden de Compra: Incoterm reintroducido (eliminado 2026-08-07 por falta de
-- catálogo; ahora reutiliza el TipoParametro INCOTERM ya sembrado para
-- Cierre Comercial).
ALTER TABLE "ordenes_compra" ADD COLUMN "incotermId" INTEGER;
CREATE INDEX "ordenes_compra_incotermId_idx" ON "ordenes_compra"("incotermId");
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_incotermId_fkey" FOREIGN KEY ("empresaId", "incotermId") REFERENCES "parametros"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
