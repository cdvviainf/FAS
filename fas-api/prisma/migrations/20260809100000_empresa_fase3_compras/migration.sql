-- Fase 3 multi-empresa, lote "Compras" (7/7, el último): OrdenCompra,
-- CondicionPago, Recepcion, Pallet y TemplateCarga pasan a ser por-empresa.
-- Self-safe (nullable -> backfill AGROSAN -> NOT NULL) — mismo patrón que
-- los lotes anteriores (Docs/empresas.md §3). Autosuficiente respecto del
-- seed: el entrypoint de despliegue corre `prisma migrate deploy` sin
-- ejecutar el seed antes.
--
-- Además retrofitea 2 FK simples que quedaron pendientes en lotes previos
-- (ProductorContrato.condicionPagoId en el lote Productores,
-- NotaVenta.condicionPagoId en el lote Ventas) — CondicionPago no era tenant
-- todavía cuando esos lotes se implementaron.
INSERT INTO "empresas" ("codigo", "razonSocial", "creadoPor")
VALUES ('AGROSAN', 'Frutera Agrosan SpA', 'system')
ON CONFLICT ("codigo") DO NOTHING;

-- ── 1. Agregar empresaId nullable a los 5 modelos ───────────────────────────
ALTER TABLE "ordenes_compra" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "condiciones_pago" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "recepciones" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "pallets" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "templates_carga" ADD COLUMN "empresaId" INTEGER;

-- ── 2. Backfill: filas existentes (si las hay) se asocian a AGROSAN ─────────
UPDATE "ordenes_compra" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "condiciones_pago" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "recepciones" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "pallets" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;
UPDATE "templates_carga" SET "empresaId" = (SELECT "id" FROM "empresas" WHERE "codigo" = 'AGROSAN') WHERE "empresaId" IS NULL;

-- ── 3. NOT NULL solo después del backfill ───────────────────────────────────
ALTER TABLE "ordenes_compra" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "condiciones_pago" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "recepciones" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "pallets" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "templates_carga" ALTER COLUMN "empresaId" SET NOT NULL;

-- ── 4. FK simple a empresas + índice regular ────────────────────────────────
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "condiciones_pago" ADD CONSTRAINT "condiciones_pago_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "templates_carga" ADD CONSTRAINT "templates_carga_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ordenes_compra_empresaId_idx" ON "ordenes_compra"("empresaId");
CREATE INDEX "condiciones_pago_empresaId_idx" ON "condiciones_pago"("empresaId");
CREATE INDEX "recepciones_empresaId_idx" ON "recepciones"("empresaId");
CREATE INDEX "pallets_empresaId_idx" ON "pallets"("empresaId");
CREATE INDEX "templates_carga_empresaId_idx" ON "templates_carga"("empresaId");

-- ── 5. Únicos globales/ocultos -> (empresaId, ...) ──────────────────────────
-- ordenes_compra.numero y recepciones.numero tienen eliminadoEn -> únicos
-- parciales. condiciones_pago.codigo y templates_carga.codigo eran índices
-- parciales crudos GLOBALES ya existentes (invisibles en el DSL de Prisma,
-- mismo caso que en lotes anteriores) -> se eliminan y se reemplazan.
DROP INDEX "ordenes_compra_numero_key";
DROP INDEX "recepciones_numero_key";
DROP INDEX "ux_condiciones_pago_codigo";
DROP INDEX "ux_templates_carga_codigo";

CREATE UNIQUE INDEX "ordenes_compra_empresa_numero_activo_key" ON "ordenes_compra"("empresaId", "numero") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "recepciones_empresa_numero_activo_key" ON "recepciones"("empresaId", "numero") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "condiciones_pago_empresa_codigo_activo_key" ON "condiciones_pago"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "templates_carga_empresa_codigo_activo_key" ON "templates_carga"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;

-- ── 6. Único (empresaId, id) en los 5 nuevos lados-padre de FK compuesta ───
-- Entidad, NotaVenta y Mercado ya lo tienen desde lotes anteriores.
CREATE UNIQUE INDEX "formas_pago_empresaId_id_key" ON "formas_pago"("empresaId", "id");
CREATE UNIQUE INDEX "condiciones_pago_empresaId_id_key" ON "condiciones_pago"("empresaId", "id");
CREATE UNIQUE INDEX "ordenes_compra_empresaId_id_key" ON "ordenes_compra"("empresaId", "id");
CREATE UNIQUE INDEX "templates_carga_empresaId_id_key" ON "templates_carga"("empresaId", "id");
CREATE UNIQUE INDEX "recepciones_empresaId_id_key" ON "recepciones"("empresaId", "id");

-- ── 7. FK compuestas: 10 relaciones nuevas + 2 retrofit ─────────────────────
ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_entidadProductorId_fkey";
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_entidadProductorId_fkey" FOREIGN KEY ("empresaId", "entidadProductorId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_notaVentaId_fkey";
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_notaVentaId_fkey" FOREIGN KEY ("empresaId", "notaVentaId") REFERENCES "notas_venta"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_formaPagoId_fkey";
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_formaPagoId_fkey" FOREIGN KEY ("empresaId", "formaPagoId") REFERENCES "formas_pago"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_condicionPagoId_fkey";
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_condicionPagoId_fkey" FOREIGN KEY ("empresaId", "condicionPagoId") REFERENCES "condiciones_pago"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_destinoMercadoId_fkey";
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_destinoMercadoId_fkey" FOREIGN KEY ("empresaId", "destinoMercadoId") REFERENCES "mercados"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recepciones" DROP CONSTRAINT "recepciones_ordenCompraId_fkey";
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_empresaId_ordenCompraId_fkey" FOREIGN KEY ("empresaId", "ordenCompraId") REFERENCES "ordenes_compra"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recepciones" DROP CONSTRAINT "recepciones_plantaId_fkey";
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_empresaId_plantaId_fkey" FOREIGN KEY ("empresaId", "plantaId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recepciones" DROP CONSTRAINT "recepciones_templateCargaId_fkey";
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_empresaId_templateCargaId_fkey" FOREIGN KEY ("empresaId", "templateCargaId") REFERENCES "templates_carga"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pallets" DROP CONSTRAINT "pallets_recepcionId_fkey";
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_empresaId_recepcionId_fkey" FOREIGN KEY ("empresaId", "recepcionId") REFERENCES "recepciones"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pallets" DROP CONSTRAINT "pallets_productorId_fkey";
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_empresaId_productorId_fkey" FOREIGN KEY ("empresaId", "productorId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Retrofit: ProductorContrato.condicionPagoId (lote Productores) y
-- NotaVenta.condicionPagoId (lote Ventas) quedaron como FK simple porque
-- CondicionPago no era tenant en ese momento.
ALTER TABLE "productor_contratos" DROP CONSTRAINT "productor_contratos_condicionPagoId_fkey";
ALTER TABLE "productor_contratos" ADD CONSTRAINT "productor_contratos_empresaId_condicionPagoId_fkey" FOREIGN KEY ("empresaId", "condicionPagoId") REFERENCES "condiciones_pago"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_condicionPagoId_fkey";
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_condicionPagoId_fkey" FOREIGN KEY ("empresaId", "condicionPagoId") REFERENCES "condiciones_pago"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
