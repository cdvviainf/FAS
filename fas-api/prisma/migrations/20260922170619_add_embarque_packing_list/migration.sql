-- CreateEnum
CREATE TYPE "EstadoPackingList" AS ENUM ('OK', 'DISCREPANCIA');

-- DropForeignKey
ALTER TABLE "articulos" DROP CONSTRAINT "articulos_empresaId_especieId_fkey";

-- DropForeignKey
ALTER TABLE "articulos" DROP CONSTRAINT "articulos_empresaId_etiquetaId_fkey";

-- DropForeignKey
ALTER TABLE "calibres" DROP CONSTRAINT "calibres_empresaId_calibreEquivalenteId_fkey";

-- DropForeignKey
ALTER TABLE "especies" DROP CONSTRAINT "especies_empresaId_unidadMedidaCalidadId_fkey";

-- DropForeignKey
ALTER TABLE "instructivo_embalaje_detalle" DROP CONSTRAINT "instructivo_embalaje_detalle_variedadRotuladaId_fkey";

-- DropForeignKey
ALTER TABLE "movimientos" DROP CONSTRAINT "movimientos_empresaId_bodegaDestinoId_fkey";

-- DropForeignKey
ALTER TABLE "movimientos" DROP CONSTRAINT "movimientos_empresaId_bodegaOrigenId_fkey";

-- DropForeignKey
ALTER TABLE "movimientos" DROP CONSTRAINT "movimientos_empresaId_entidadId_fkey";

-- DropForeignKey
ALTER TABLE "movimientos" DROP CONSTRAINT "movimientos_empresaId_transporteEntidadId_fkey";

-- DropForeignKey
ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_empresaId_clausulaVentaId_fkey";

-- DropForeignKey
ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_empresaId_condicionPagoId_fkey";

-- DropForeignKey
ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_empresaId_consignatarioId_fkey";

-- DropForeignKey
ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_empresaId_modalidadVentaId_fkey";

-- DropForeignKey
ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_empresaId_notifyId_fkey";

-- DropForeignKey
ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_empresaId_puertoDestinoId_fkey";

-- DropForeignKey
ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_empresaId_tipoFleteId_fkey";

-- DropForeignKey
ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_empresaId_condicionPagoId_fkey";

-- DropForeignKey
ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_empresaId_destinoMercadoId_fkey";

-- DropForeignKey
ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_empresaId_formaPagoId_fkey";

-- DropForeignKey
ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_empresaId_notaVentaId_fkey";

-- DropForeignKey
ALTER TABLE "pallet_lineas" DROP CONSTRAINT "pallet_lineas_etiquetaId_fkey";

-- DropForeignKey
ALTER TABLE "pallet_lineas" DROP CONSTRAINT "pallet_lineas_packingId_fkey";

-- DropForeignKey
ALTER TABLE "predios" DROP CONSTRAINT "predios_empresaId_tipoProduccionId_fkey";

-- DropForeignKey
ALTER TABLE "productor_contratos" DROP CONSTRAINT "productor_contratos_empresaId_condicionPagoId_fkey";

-- DropForeignKey
ALTER TABLE "recepciones" DROP CONSTRAINT "recepciones_empresaId_ordenCompraId_fkey";

-- DropForeignKey
ALTER TABLE "recepciones" DROP CONSTRAINT "recepciones_empresaId_templateCargaId_fkey";

-- DropForeignKey
ALTER TABLE "solicitudes_inspeccion" DROP CONSTRAINT "solicitudes_inspeccion_empresaId_clienteId_fkey";

-- DropForeignKey
ALTER TABLE "solicitudes_inspeccion" DROP CONSTRAINT "solicitudes_inspeccion_empresaId_especieId_fkey";

-- DropForeignKey
ALTER TABLE "solicitudes_inspeccion" DROP CONSTRAINT "solicitudes_inspeccion_empresaId_mercadoId_fkey";

-- DropIndex
DROP INDEX "instructivos_embalaje_empresaId_numero_key";

-- DropIndex
DROP INDEX "ordenes_compra_incotermId_idx";

-- CreateTable
CREATE TABLE "embarque_packing_lists" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "embarqueId" INTEGER NOT NULL,
    "templateCargaId" INTEGER NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "estado" "EstadoPackingList" NOT NULL,
    "discrepancias" JSONB NOT NULL,
    "cargadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cargadoPor" TEXT NOT NULL,

    CONSTRAINT "embarque_packing_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embarque_packing_lists_contenido" (
    "packingListId" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,

    CONSTRAINT "embarque_packing_lists_contenido_pkey" PRIMARY KEY ("packingListId")
);

-- CreateIndex
CREATE INDEX "embarque_packing_lists_empresaId_idx" ON "embarque_packing_lists"("empresaId");

-- CreateIndex
CREATE INDEX "embarque_packing_lists_templateCargaId_idx" ON "embarque_packing_lists"("templateCargaId");

-- CreateIndex
CREATE UNIQUE INDEX "embarque_packing_lists_empresaId_embarqueId_key" ON "embarque_packing_lists"("empresaId", "embarqueId");

-- AddForeignKey
ALTER TABLE "especies" ADD CONSTRAINT "especies_empresaId_unidadMedidaCalidadId_fkey" FOREIGN KEY ("empresaId", "unidadMedidaCalidadId") REFERENCES "unidades_medida"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibres" ADD CONSTRAINT "calibres_empresaId_calibreEquivalenteId_fkey" FOREIGN KEY ("empresaId", "calibreEquivalenteId") REFERENCES "calibres"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercados" ADD CONSTRAINT "mercados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_empresaId_especieId_fkey" FOREIGN KEY ("empresaId", "especieId") REFERENCES "especies"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_empresaId_mercadoId_fkey" FOREIGN KEY ("empresaId", "mercadoId") REFERENCES "mercados"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_empresaId_clienteId_fkey" FOREIGN KEY ("empresaId", "clienteId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_empresaId_etiquetaId_fkey" FOREIGN KEY ("empresaId", "etiquetaId") REFERENCES "etiquetas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_empresaId_especieId_fkey" FOREIGN KEY ("empresaId", "especieId") REFERENCES "especies"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_empresaId_entidadId_fkey" FOREIGN KEY ("empresaId", "entidadId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_empresaId_bodegaOrigenId_fkey" FOREIGN KEY ("empresaId", "bodegaOrigenId") REFERENCES "bodegas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_empresaId_bodegaDestinoId_fkey" FOREIGN KEY ("empresaId", "bodegaDestinoId") REFERENCES "bodegas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_empresaId_transporteEntidadId_fkey" FOREIGN KEY ("empresaId", "transporteEntidadId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predios" ADD CONSTRAINT "predios_empresaId_tipoProduccionId_fkey" FOREIGN KEY ("empresaId", "tipoProduccionId") REFERENCES "tipos_produccion"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contratos" ADD CONSTRAINT "productor_contratos_empresaId_condicionPagoId_fkey" FOREIGN KEY ("empresaId", "condicionPagoId") REFERENCES "condiciones_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_notifyId_fkey" FOREIGN KEY ("empresaId", "notifyId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_consignatarioId_fkey" FOREIGN KEY ("empresaId", "consignatarioId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_puertoDestinoId_fkey" FOREIGN KEY ("empresaId", "puertoDestinoId") REFERENCES "puertos"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_modalidadVentaId_fkey" FOREIGN KEY ("empresaId", "modalidadVentaId") REFERENCES "parametros"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_clausulaVentaId_fkey" FOREIGN KEY ("empresaId", "clausulaVentaId") REFERENCES "parametros"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_tipoFleteId_fkey" FOREIGN KEY ("empresaId", "tipoFleteId") REFERENCES "parametros"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_condicionPagoId_fkey" FOREIGN KEY ("empresaId", "condicionPagoId") REFERENCES "condiciones_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embarque_packing_lists" ADD CONSTRAINT "embarque_packing_lists_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embarque_packing_lists" ADD CONSTRAINT "embarque_packing_lists_empresaId_embarqueId_fkey" FOREIGN KEY ("empresaId", "embarqueId") REFERENCES "embarques"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embarque_packing_lists" ADD CONSTRAINT "embarque_packing_lists_templateCargaId_fkey" FOREIGN KEY ("templateCargaId") REFERENCES "templates_carga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embarque_packing_lists_contenido" ADD CONSTRAINT "embarque_packing_lists_contenido_packingListId_fkey" FOREIGN KEY ("packingListId") REFERENCES "embarque_packing_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructivo_embalaje_detalle" ADD CONSTRAINT "instructivo_embalaje_detalle_variedadRotuladaId_fkey" FOREIGN KEY ("variedadRotuladaId") REFERENCES "variedades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_notaVentaId_fkey" FOREIGN KEY ("empresaId", "notaVentaId") REFERENCES "notas_venta"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_formaPagoId_fkey" FOREIGN KEY ("empresaId", "formaPagoId") REFERENCES "formas_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_condicionPagoId_fkey" FOREIGN KEY ("empresaId", "condicionPagoId") REFERENCES "condiciones_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_destinoMercadoId_fkey" FOREIGN KEY ("empresaId", "destinoMercadoId") REFERENCES "mercados"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_empresaId_ordenCompraId_fkey" FOREIGN KEY ("empresaId", "ordenCompraId") REFERENCES "ordenes_compra"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_empresaId_templateCargaId_fkey" FOREIGN KEY ("empresaId", "templateCargaId") REFERENCES "templates_carga"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallet_lineas" ADD CONSTRAINT "pallet_lineas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallet_lineas" ADD CONSTRAINT "pallet_lineas_packingId_fkey" FOREIGN KEY ("packingId") REFERENCES "entidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

