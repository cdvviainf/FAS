-- Extrae "Cláusula de Venta (Incoterm)" del catálogo genérico Parametro a su
-- propio mantenedor ClausulaVenta (decisión de negocio, 2026-09-30): el
-- catch-all Parametro no hacía descubrible requiereFlete/requiereSeguro en su
-- listado. Preserva los mismos `id` que tenían como Parametro tipo INCOTERM,
-- para no reescribir las FKs ya existentes en notas_venta/ordenes_compra.

-- 1. Tabla nueva (mismas columnas que parametros, sin tipoParametroId, con
--    requiereFlete/requiereSeguro).
CREATE TABLE "clausulas_venta" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "descripcionExtranjera" TEXT,
    "requiereFlete" BOOLEAN NOT NULL DEFAULT false,
    "requiereSeguro" BOOLEAN NOT NULL DEFAULT false,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "clausulas_venta_pkey" PRIMARY KEY ("id")
);

-- 2. Migra los datos: filas Parametro cuyo TipoParametro.codigo = 'INCOTERM',
--    conservando el mismo id.
INSERT INTO "clausulas_venta"
  ("id", "empresaId", "codigo", "descripcion", "descripcionExtranjera", "requiereFlete", "requiereSeguro", "bloqueado", "creadoEn", "creadoPor", "actualizadoEn", "actualizadoPor", "eliminadoEn", "eliminadoPor")
SELECT
  p."id", p."empresaId", p."codigo", p."descripcion", p."descripcionExtranjera", p."requiereFlete", p."requiereSeguro", p."bloqueado", p."creadoEn", p."creadoPor", p."actualizadoEn", p."actualizadoPor", p."eliminadoEn", p."eliminadoPor"
FROM "parametros" p
JOIN "tipos_parametro" tp ON tp."empresaId" = p."empresaId" AND tp."id" = p."tipoParametroId"
WHERE tp."codigo" = 'INCOTERM';

-- 2b. Backfill de flags por código (CVD-QA-002): la migración previa
--     (20260929120000_clausula_flete_seguro) agregó requiereFlete/
--     requiereSeguro con DEFAULT false a TODOS los Parametro existentes, así
--     que el copy del paso 2 arrastra ese `false` para CFR/CIF aunque la
--     decisión de negocio sea que sí los exigen. Solo toca los códigos
--     estándar conocidos; una cláusula custom con otro código no se altera.
UPDATE "clausulas_venta" SET "requiereFlete" = true, "requiereSeguro" = false WHERE "codigo" = 'CFR';
UPDATE "clausulas_venta" SET "requiereFlete" = true, "requiereSeguro" = true WHERE "codigo" = 'CIF';

-- 3. Ajusta la secuencia del id autogenerado para que el próximo INSERT (vía
--    Prisma, sin id explícito) no colisione con los ids recién copiados.
SELECT setval(pg_get_serial_sequence('"clausulas_venta"', 'id'), COALESCE((SELECT MAX("id") FROM "clausulas_venta"), 1));

-- 4. Índices (igual que el resto de los mantenedores tenant-scoped).
CREATE UNIQUE INDEX "clausulas_venta_empresaId_id_key" ON "clausulas_venta"("empresaId", "id");
CREATE INDEX "clausulas_venta_empresaId_idx" ON "clausulas_venta"("empresaId");
-- Unicidad de código entre registros activos, mismo patrón que puertos
-- (puertos_empresa_codigo_activo_key, migración 20260803100000).
CREATE UNIQUE INDEX "clausulas_venta_empresa_codigo_activo_key" ON "clausulas_venta"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;

-- 5. FK a Empresa.
ALTER TABLE "clausulas_venta" ADD CONSTRAINT "clausulas_venta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Repunta NotaVenta.clausulaVentaId: de parametros -> clausulas_venta
--    (mismo nombre de constraint, mismo ON DELETE/UPDATE que tenía).
ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_empresaId_clausulaVentaId_fkey";
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_clausulaVentaId_fkey" FOREIGN KEY ("empresaId", "clausulaVentaId") REFERENCES "clausulas_venta"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Repunta OrdenCompra.incotermId: de parametros -> clausulas_venta.
ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_empresaId_incotermId_fkey";
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_incotermId_fkey" FOREIGN KEY ("empresaId", "incotermId") REFERENCES "clausulas_venta"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. requiereFlete/requiereSeguro ya no se usan en Parametro genérico.
ALTER TABLE "parametros" DROP COLUMN "requiereFlete";
ALTER TABLE "parametros" DROP COLUMN "requiereSeguro";

-- 9. Las filas Parametro tipo INCOTERM ya fueron copiadas a clausulas_venta
--    (paso 2) y ninguna FK las referencia más (pasos 6-7): soft-delete para
--    que dejen de listarse en la pantalla de Parámetros (soft delete only,
--    no se pierden datos/auditoría).
UPDATE "parametros" p
SET "eliminadoEn" = CURRENT_TIMESTAMP, "eliminadoPor" = 'system'
FROM "tipos_parametro" tp
WHERE tp."empresaId" = p."empresaId" AND tp."id" = p."tipoParametroId"
  AND tp."codigo" = 'INCOTERM' AND p."eliminadoEn" IS NULL;

-- 10. El TipoParametro INCOTERM queda deprecado/bloqueado (no se elimina:
--     conserva el historial de los Parametro ya soft-deleted que aún lo
--     referencian). bloqueado=true evita que se sigan creando nuevos
--     Parametro bajo este tipo desde la pantalla genérica.
UPDATE "tipos_parametro"
SET "bloqueado" = true
WHERE "codigo" = 'INCOTERM' AND "eliminadoEn" IS NULL;
