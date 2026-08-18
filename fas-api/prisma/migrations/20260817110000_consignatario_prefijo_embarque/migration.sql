-- NotaVenta: "Cliente Final" (clienteFinalId) se renombra a consignatarioId
-- (2026-08-13) — el rol de Entidad correcto para este campo ya existía como
-- CONSIGNATARIO (TipoEntidad) y nunca se usaba en NotaVenta.
ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_empresaId_clienteFinalId_fkey";
ALTER TABLE "notas_venta" RENAME COLUMN "clienteFinalId" TO "consignatarioId";
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_consignatarioId_fkey" FOREIGN KEY ("empresaId", "consignatarioId") REFERENCES "entidades"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PrefijoCodigo: tipoEmbarqueId opcional — solo aplica a modelo='embarque'
-- (Docs/ventas.md R10, supersesión 2026-08-13). El número de instructivo del
-- Embarque se genera como {prefijo}{folio de la NV}, y cada Tipo de Embarque
-- necesita su propio prefijo.
ALTER TABLE "prefijos_codigo" ADD COLUMN "tipoEmbarqueId" INTEGER;
CREATE INDEX "prefijos_codigo_tipoEmbarqueId_idx" ON "prefijos_codigo"("tipoEmbarqueId");
ALTER TABLE "prefijos_codigo" ADD CONSTRAINT "prefijos_codigo_empresaId_tipoEmbarqueId_fkey" FOREIGN KEY ("empresaId", "tipoEmbarqueId") REFERENCES "tipos_embarque"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Unicidad partida en dos índices parciales (no representable en el DSL de
-- Prisma, mismo criterio ya usado en el resto del proyecto): cuando
-- tipoEmbarqueId es NULL (todos los modelos salvo 'embarque'), único por
-- (empresaId, modelo) como antes; cuando no es NULL (solo 'embarque'),
-- único por (empresaId, modelo, tipoEmbarqueId) — un prefijo por tipo.
DROP INDEX "prefijos_codigo_empresa_modelo_activo_key";
CREATE UNIQUE INDEX "prefijos_codigo_empresa_modelo_sin_tipo_activo_key" ON "prefijos_codigo"("empresaId", "modelo") WHERE "eliminadoEn" IS NULL AND "tipoEmbarqueId" IS NULL;
CREATE UNIQUE INDEX "prefijos_codigo_empresa_modelo_tipo_activo_key" ON "prefijos_codigo"("empresaId", "modelo", "tipoEmbarqueId") WHERE "eliminadoEn" IS NULL AND "tipoEmbarqueId" IS NOT NULL;
