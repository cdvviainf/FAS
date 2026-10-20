-- Cobranza — Pagos (Ciclo 1, 2026-10-19, cobranza.md §0.e/§4-§5).
-- Registro de pagos de facturas (Exportación + Nacional) según vencimientos.
-- Aislamiento tenant a nivel BD: empresaId + FKs compuestas (empresaId, id) en
-- toda la cadena pago↔factura↔cuota. Supersede VN6 (Nacional en cartera) y
-- D9/CB17 (multi-moneda con conversión). Solo modelo de datos.

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('TRANSFERENCIA', 'CHEQUE', 'EFECTIVO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoCobranza" AS ENUM ('SIN_CUOTAS', 'PENDIENTE', 'PARCIAL', 'PAGADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "EstadoCuotaFacturaNacional" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADA', 'VENCIDA');

-- DropForeignKey
ALTER TABLE "factura_exportacion_cuotas" DROP CONSTRAINT "factura_exportacion_cuotas_facturaExportacionId_fkey";





-- AlterTable
ALTER TABLE "factura_exportacion_cuotas" ADD COLUMN "empresaId" INTEGER;
ALTER TABLE "factura_exportacion_cuotas" ADD COLUMN "montoPagado" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "factura_exportacion_cuotas" ADD COLUMN "saldoPendiente" DECIMAL(14,2);
-- Backfill: empresaId desde la factura padre; saldoPendiente = montoCuota (nada pagado aún).
UPDATE "factura_exportacion_cuotas" c SET "empresaId" = f."empresaId" FROM "facturas_exportacion" f WHERE f."id" = c."facturaExportacionId";
UPDATE "factura_exportacion_cuotas" SET "saldoPendiente" = "montoCuota" WHERE "saldoPendiente" IS NULL;
ALTER TABLE "factura_exportacion_cuotas" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "factura_exportacion_cuotas" ALTER COLUMN "saldoPendiente" SET NOT NULL;

-- AlterTable
ALTER TABLE "facturas_exportacion" ADD COLUMN     "estadoCobranza" "EstadoCobranza";

-- AlterTable
ALTER TABLE "facturas_nacional" ADD COLUMN     "estadoCobranza" "EstadoCobranza";

-- CreateTable
CREATE TABLE "factura_nacional_cuotas" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "facturaNacionalId" INTEGER NOT NULL,
    "numeroCuota" INTEGER NOT NULL,
    "fechaReferencia" "FechaReferenciaPago" NOT NULL,
    "plazoDias" INTEGER NOT NULL,
    "montoCuota" DECIMAL(14,2) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "montoPagado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "saldoPendiente" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoCuotaFacturaNacional" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "factura_nacional_cuotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "monedaId" INTEGER NOT NULL,
    "medioPago" "MedioPago" NOT NULL,
    "referencia" TEXT,
    "observacion" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3),
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago_aplicacion_documento" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "pagoId" INTEGER NOT NULL,
    "facturaExportacionId" INTEGER,
    "facturaNacionalId" INTEGER,
    "tipoCambioAplicado" DECIMAL(14,6) NOT NULL DEFAULT 1,
    "montoAplicado" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_aplicacion_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago_aplicacion_cuota" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "pagoAplicacionDocumentoId" INTEGER NOT NULL,
    "facturaExportacionCuotaId" INTEGER,
    "facturaNacionalCuotaId" INTEGER,
    "monto" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "pago_aplicacion_cuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldos_a_favor_cliente" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "monedaId" INTEGER NOT NULL,
    "montoOriginal" DECIMAL(14,2) NOT NULL,
    "montoDisponible" DECIMAL(14,2) NOT NULL,
    "pagoOrigenId" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "saldos_a_favor_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldo_a_favor_aplicacion" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "saldoAFavorId" INTEGER NOT NULL,
    "facturaExportacionId" INTEGER,
    "facturaNacionalId" INTEGER,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saldo_a_favor_aplicacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "factura_nacional_cuotas_facturaNacionalId_idx" ON "factura_nacional_cuotas"("facturaNacionalId");

-- CreateIndex
CREATE INDEX "factura_nacional_cuotas_fechaVencimiento_idx" ON "factura_nacional_cuotas"("fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "factura_nacional_cuotas_empresaId_id_key" ON "factura_nacional_cuotas"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "factura_nacional_cuotas_facturaNacionalId_numeroCuota_key" ON "factura_nacional_cuotas"("facturaNacionalId", "numeroCuota");

-- CreateIndex
CREATE INDEX "pagos_empresaId_idx" ON "pagos"("empresaId");

-- CreateIndex
CREATE INDEX "pagos_clienteId_idx" ON "pagos"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_empresaId_id_key" ON "pagos"("empresaId", "id");

-- CreateIndex
CREATE INDEX "pago_aplicacion_documento_pagoId_idx" ON "pago_aplicacion_documento"("pagoId");

-- CreateIndex
CREATE INDEX "pago_aplicacion_documento_facturaExportacionId_idx" ON "pago_aplicacion_documento"("facturaExportacionId");

-- CreateIndex
CREATE INDEX "pago_aplicacion_documento_facturaNacionalId_idx" ON "pago_aplicacion_documento"("facturaNacionalId");

-- CreateIndex
CREATE UNIQUE INDEX "pago_aplicacion_documento_empresaId_id_key" ON "pago_aplicacion_documento"("empresaId", "id");

-- CreateIndex
CREATE INDEX "pago_aplicacion_cuota_pagoAplicacionDocumentoId_idx" ON "pago_aplicacion_cuota"("pagoAplicacionDocumentoId");

-- CreateIndex
CREATE INDEX "pago_aplicacion_cuota_facturaExportacionCuotaId_idx" ON "pago_aplicacion_cuota"("facturaExportacionCuotaId");

-- CreateIndex
CREATE INDEX "pago_aplicacion_cuota_facturaNacionalCuotaId_idx" ON "pago_aplicacion_cuota"("facturaNacionalCuotaId");

-- CreateIndex
CREATE INDEX "saldos_a_favor_cliente_empresaId_idx" ON "saldos_a_favor_cliente"("empresaId");

-- CreateIndex
CREATE INDEX "saldos_a_favor_cliente_clienteId_idx" ON "saldos_a_favor_cliente"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "saldos_a_favor_cliente_empresaId_id_key" ON "saldos_a_favor_cliente"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "saldos_a_favor_cliente_empresaId_pagoOrigenId_key" ON "saldos_a_favor_cliente"("empresaId", "pagoOrigenId");

-- CreateIndex
CREATE INDEX "saldo_a_favor_aplicacion_saldoAFavorId_idx" ON "saldo_a_favor_aplicacion"("saldoAFavorId");

-- CreateIndex
CREATE INDEX "saldo_a_favor_aplicacion_facturaExportacionId_idx" ON "saldo_a_favor_aplicacion"("facturaExportacionId");

-- CreateIndex
CREATE INDEX "saldo_a_favor_aplicacion_facturaNacionalId_idx" ON "saldo_a_favor_aplicacion"("facturaNacionalId");

-- CreateIndex
CREATE INDEX "factura_exportacion_cuotas_fechaVencimiento_idx" ON "factura_exportacion_cuotas"("fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "factura_exportacion_cuotas_empresaId_id_key" ON "factura_exportacion_cuotas"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_exportacion_empresaId_id_key" ON "facturas_exportacion"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_nacional_empresaId_id_key" ON "facturas_nacional"("empresaId", "id");

-- AddForeignKey
ALTER TABLE "factura_exportacion_cuotas" ADD CONSTRAINT "factura_exportacion_cuotas_empresaId_facturaExportacionId_fkey" FOREIGN KEY ("empresaId", "facturaExportacionId") REFERENCES "facturas_exportacion"("empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;




-- AddForeignKey
ALTER TABLE "factura_nacional_cuotas" ADD CONSTRAINT "factura_nacional_cuotas_empresaId_facturaNacionalId_fkey" FOREIGN KEY ("empresaId", "facturaNacionalId") REFERENCES "facturas_nacional"("empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_empresaId_clienteId_fkey" FOREIGN KEY ("empresaId", "clienteId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_aplicacion_documento" ADD CONSTRAINT "pago_aplicacion_documento_empresaId_pagoId_fkey" FOREIGN KEY ("empresaId", "pagoId") REFERENCES "pagos"("empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_aplicacion_documento" ADD CONSTRAINT "pago_aplicacion_documento_empresaId_facturaExportacionId_fkey" FOREIGN KEY ("empresaId", "facturaExportacionId") REFERENCES "facturas_exportacion"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_aplicacion_documento" ADD CONSTRAINT "pago_aplicacion_documento_empresaId_facturaNacionalId_fkey" FOREIGN KEY ("empresaId", "facturaNacionalId") REFERENCES "facturas_nacional"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_aplicacion_cuota" ADD CONSTRAINT "pago_aplicacion_cuota_empresaId_pagoAplicacionDocumentoId_fkey" FOREIGN KEY ("empresaId", "pagoAplicacionDocumentoId") REFERENCES "pago_aplicacion_documento"("empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_aplicacion_cuota" ADD CONSTRAINT "pago_aplicacion_cuota_empresaId_facturaExportacionCuotaId_fkey" FOREIGN KEY ("empresaId", "facturaExportacionCuotaId") REFERENCES "factura_exportacion_cuotas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_aplicacion_cuota" ADD CONSTRAINT "pago_aplicacion_cuota_empresaId_facturaNacionalCuotaId_fkey" FOREIGN KEY ("empresaId", "facturaNacionalCuotaId") REFERENCES "factura_nacional_cuotas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_a_favor_cliente" ADD CONSTRAINT "saldos_a_favor_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_a_favor_cliente" ADD CONSTRAINT "saldos_a_favor_cliente_empresaId_clienteId_fkey" FOREIGN KEY ("empresaId", "clienteId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_a_favor_cliente" ADD CONSTRAINT "saldos_a_favor_cliente_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_a_favor_cliente" ADD CONSTRAINT "saldos_a_favor_cliente_empresaId_pagoOrigenId_fkey" FOREIGN KEY ("empresaId", "pagoOrigenId") REFERENCES "pagos"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldo_a_favor_aplicacion" ADD CONSTRAINT "saldo_a_favor_aplicacion_empresaId_saldoAFavorId_fkey" FOREIGN KEY ("empresaId", "saldoAFavorId") REFERENCES "saldos_a_favor_cliente"("empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldo_a_favor_aplicacion" ADD CONSTRAINT "saldo_a_favor_aplicacion_empresaId_facturaExportacionId_fkey" FOREIGN KEY ("empresaId", "facturaExportacionId") REFERENCES "facturas_exportacion"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldo_a_favor_aplicacion" ADD CONSTRAINT "saldo_a_favor_aplicacion_empresaId_facturaNacionalId_fkey" FOREIGN KEY ("empresaId", "facturaNacionalId") REFERENCES "facturas_nacional"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── SCH-003: backfill de estadoCobranza en facturas de exportación ya APROBADAS
-- con cuotas (VENCIDA si alguna cuota vencida con saldo; si no, PENDIENTE).
UPDATE "facturas_exportacion" f SET "estadoCobranza" = CASE
  WHEN EXISTS (SELECT 1 FROM "factura_exportacion_cuotas" c
               WHERE c."facturaExportacionId" = f."id"
                 AND c."fechaVencimiento" IS NOT NULL
                 AND c."fechaVencimiento" < CURRENT_DATE
                 AND c."saldoPendiente" > 0) THEN 'VENCIDA'::"EstadoCobranza"
  ELSE 'PENDIENTE'::"EstadoCobranza" END
WHERE f."estado" = 'APROBADA'
  AND EXISTS (SELECT 1 FROM "factura_exportacion_cuotas" c WHERE c."facturaExportacionId" = f."id");

-- ── SCH-001: CHECK XOR — exactamente un documento/cuota destino por aplicación.
ALTER TABLE "pago_aplicacion_documento" ADD CONSTRAINT "pago_aplic_doc_una_factura"
  CHECK (("facturaExportacionId" IS NOT NULL)::int + ("facturaNacionalId" IS NOT NULL)::int = 1);
ALTER TABLE "pago_aplicacion_cuota" ADD CONSTRAINT "pago_aplic_cuota_una_cuota"
  CHECK (("facturaExportacionCuotaId" IS NOT NULL)::int + ("facturaNacionalCuotaId" IS NOT NULL)::int = 1);
ALTER TABLE "saldo_a_favor_aplicacion" ADD CONSTRAINT "saldo_aplic_una_factura"
  CHECK (("facturaExportacionId" IS NOT NULL)::int + ("facturaNacionalId" IS NOT NULL)::int = 1);

-- ── SCH-005: unicidad de codigo por empresa, parcial (permite reuso tras soft delete).
CREATE UNIQUE INDEX "pagos_empresaId_codigo_key" ON "pagos"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;

-- ── SCH-004: provisionar el prefijo PAG (modelo 'pago') para las empresas
-- existentes (prod no corre seed). Idempotente.
INSERT INTO "prefijos_codigo" ("empresaId", "modelo", "prefijo", "digitos", "creadoPor")
SELECT e."id", 'pago', 'PAG', 4, 'migracion-cobranza'
FROM "empresas" e
WHERE NOT EXISTS (
  SELECT 1 FROM "prefijos_codigo" p
  WHERE p."empresaId" = e."id" AND p."modelo" = 'pago' AND p."eliminadoEn" IS NULL
);
