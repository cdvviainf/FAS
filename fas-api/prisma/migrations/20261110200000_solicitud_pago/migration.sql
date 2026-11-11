-- Solicitud de Pago a Productores (2026-11-10). Se paga por cuotas de la
-- condición de pago de la OC sobre lo realmente despachado; confirmar el pago
-- genera un DEBE por cuota en la cta. cte. del productor.
-- CreateEnum
CREATE TYPE "EstadoSolicitudPago" AS ENUM ('SOLICITADA', 'PAGADA', 'ANULADA');

-- CreateTable
CREATE TABLE "solicitudes_pago" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "temporadaId" INTEGER NOT NULL,
    "entidadProductorId" INTEGER NOT NULL,
    "monedaId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "estado" "EstadoSolicitudPago" NOT NULL DEFAULT 'SOLICITADA',
    "montoTotal" DECIMAL(14,2) NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "numeroTransferencia" TEXT,
    "conceptoCtaCteId" INTEGER,
    "pagadoEn" TIMESTAMP(3),
    "pagadoPor" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "anuladoPor" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,

    CONSTRAINT "solicitudes_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_pago_lineas" (
    "id" SERIAL NOT NULL,
    "solicitudPagoId" INTEGER NOT NULL,
    "ordenCompraId" INTEGER NOT NULL,
    "embarqueId" INTEGER NOT NULL,
    "ordenCompraCuotaPagoId" INTEGER,
    "numeroCuota" INTEGER NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "montoCalculado" DECIMAL(14,2) NOT NULL,
    "montoSolicitado" DECIMAL(14,2) NOT NULL,
    "numeroFactura" TEXT,
    "movimientoCcId" INTEGER,
    "movimientoAnulacionCcId" INTEGER,

    CONSTRAINT "solicitud_pago_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_pago_entidadProductorId_idx" ON "solicitudes_pago"("entidadProductorId");

-- CreateIndex
CREATE INDEX "solicitudes_pago_empresaId_estado_idx" ON "solicitudes_pago"("empresaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_pago_empresaId_id_key" ON "solicitudes_pago"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_pago_empresaId_numero_key" ON "solicitudes_pago"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_pago_lineas_movimientoCcId_key" ON "solicitud_pago_lineas"("movimientoCcId");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_pago_lineas_movimientoAnulacionCcId_key" ON "solicitud_pago_lineas"("movimientoAnulacionCcId");

-- CreateIndex
CREATE INDEX "solicitud_pago_lineas_solicitudPagoId_idx" ON "solicitud_pago_lineas"("solicitudPagoId");

-- CreateIndex
CREATE INDEX "solicitud_pago_lineas_ordenCompraId_embarqueId_idx" ON "solicitud_pago_lineas"("ordenCompraId", "embarqueId");

-- AddForeignKey
ALTER TABLE "solicitudes_pago" ADD CONSTRAINT "solicitudes_pago_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_pago" ADD CONSTRAINT "solicitudes_pago_empresaId_temporadaId_fkey" FOREIGN KEY ("empresaId", "temporadaId") REFERENCES "temporadas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_pago" ADD CONSTRAINT "solicitudes_pago_empresaId_entidadProductorId_fkey" FOREIGN KEY ("empresaId", "entidadProductorId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_pago" ADD CONSTRAINT "solicitudes_pago_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_pago" ADD CONSTRAINT "solicitudes_pago_empresaId_conceptoCtaCteId_fkey" FOREIGN KEY ("empresaId", "conceptoCtaCteId") REFERENCES "conceptos_cta_cte"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_pago_lineas" ADD CONSTRAINT "solicitud_pago_lineas_solicitudPagoId_fkey" FOREIGN KEY ("solicitudPagoId") REFERENCES "solicitudes_pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_pago_lineas" ADD CONSTRAINT "solicitud_pago_lineas_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_pago_lineas" ADD CONSTRAINT "solicitud_pago_lineas_embarqueId_fkey" FOREIGN KEY ("embarqueId") REFERENCES "embarques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_pago_lineas" ADD CONSTRAINT "solicitud_pago_lineas_ordenCompraCuotaPagoId_fkey" FOREIGN KEY ("ordenCompraCuotaPagoId") REFERENCES "orden_compra_cuota_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_pago_lineas" ADD CONSTRAINT "solicitud_pago_lineas_movimientoCcId_fkey" FOREIGN KEY ("movimientoCcId") REFERENCES "movimientos_cuenta_corriente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_pago_lineas" ADD CONSTRAINT "solicitud_pago_lineas_movimientoAnulacionCcId_fkey" FOREIGN KEY ("movimientoAnulacionCcId") REFERENCES "movimientos_cuenta_corriente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ítems de menú (el seed NO corre en el deploy). La pantalla hereda el nivel de
-- "Proforma a Productores"; el permiso de confirmar pago (ACCION) se asigna a
-- mano (normalmente tesorería).
INSERT INTO "items_menu" ("codigo", "nombre", "grupo", "seccion", "ruta", "esAccion", "tipo", "orden")
VALUES
  ('PROD_SOLICITUD_PAGO', 'Solicitud de Pago', 'Gestión Productores', 'Productores', '/dashboard/productores/pagos', false, 'PANTALLA', 4160),
  ('PROD_SOLICITUD_PAGO_CONFIRMAR', 'Confirmar Pago a Productor', 'Gestión Productores', 'Productores', NULL, true, 'ACCION', 4165)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "grupo" = EXCLUDED."grupo",
  "seccion" = EXCLUDED."seccion",
  "ruta" = EXCLUDED."ruta",
  "esAccion" = EXCLUDED."esAccion",
  "tipo" = EXCLUDED."tipo",
  "orden" = EXCLUDED."orden";

INSERT INTO "perfil_accesos" ("perfilId", "itemMenuId", "nivel")
SELECT pa."perfilId", destino."id", pa."nivel"
FROM "perfil_accesos" pa
JOIN "items_menu" origen ON origen."id" = pa."itemMenuId" AND origen."codigo" = 'PRODUCTORES_PROFORMA'
JOIN "items_menu" destino ON destino."codigo" = 'PROD_SOLICITUD_PAGO'
ON CONFLICT ("perfilId", "itemMenuId") DO NOTHING;
