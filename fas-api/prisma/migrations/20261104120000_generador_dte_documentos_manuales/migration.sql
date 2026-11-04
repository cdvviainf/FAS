-- Generador DTE — documentos manuales (2026-11-04)
-- Digitación manual de documentos electrónicos (Factura Nacional 33/34, Guía de
-- Despacho 52, Nota de Crédito 61, Nota de Débito 56). Fase 1: solo digitación
-- (BORRADOR + PDF preview).

-- Enums
CREATE TYPE "ClaseDocumentoManual" AS ENUM ('FACTURA_NACIONAL', 'GUIA_DESPACHO', 'NOTA_CREDITO', 'NOTA_DEBITO');
CREATE TYPE "EstadoDocumentoManual" AS ENUM ('BORRADOR', 'ENVIADA_SII', 'APROBADA', 'RECHAZADA', 'ANULADA');

-- Cabecera
CREATE TABLE "documentos_manuales" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "claseDocumento" "ClaseDocumentoManual" NOT NULL,
    "tipoDte" INTEGER NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "monedaId" INTEGER NOT NULL,
    "tipoCambio" DECIMAL(14,4),
    "fechaTipoCambio" TIMESTAMP(3),
    "condicionPagoId" INTEGER,
    "montoNeto" DECIMAL(14,2) NOT NULL,
    "montoExento" DECIMAL(14,2) NOT NULL,
    "montoIva" DECIMAL(14,2) NOT NULL,
    "montoTotal" DECIMAL(14,2) NOT NULL,
    "idioma" TEXT NOT NULL DEFAULT 'ES',
    "estado" "EstadoDocumentoManual" NOT NULL DEFAULT 'BORRADOR',
    "fechaDocumento" TIMESTAMP(3) NOT NULL,
    "observaciones" TEXT,
    "guiaIndTraslado" INTEGER,
    "guiaTransporteId" INTEGER,
    "guiaChoferRut" TEXT,
    "guiaChoferChileno" BOOLEAN NOT NULL DEFAULT true,
    "guiaChoferNombre" TEXT,
    "guiaPatenteCamion" TEXT,
    "guiaPatenteRemolque" TEXT,
    "guiaDirOrigen" TEXT,
    "guiaComunaOrigen" TEXT,
    "guiaDirDestino" TEXT,
    "guiaComunaDestino" TEXT,
    "folio" INTEGER,
    "trackIdSii" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3),
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "documentos_manuales_pkey" PRIMARY KEY ("id")
);

-- Detalle
CREATE TABLE "documento_manual_lineas" (
    "id" SERIAL NOT NULL,
    "documentoManualId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "articuloId" INTEGER,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "precioUnitario" DECIMAL(14,4) NOT NULL,
    "exento" BOOLEAN NOT NULL DEFAULT false,
    "montoLinea" DECIMAL(14,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "documento_manual_lineas_pkey" PRIMARY KEY ("id")
);

-- Referencias (NC/ND)
CREATE TABLE "documento_manual_referencias" (
    "id" SERIAL NOT NULL,
    "documentoManualId" INTEGER NOT NULL,
    "tipoDocRef" TEXT NOT NULL,
    "folioRef" TEXT NOT NULL,
    "fechaRef" TIMESTAMP(3) NOT NULL,
    "codRef" INTEGER,
    "razonRef" TEXT,
    "refOrigenTipo" TEXT,
    "refOrigenId" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "documento_manual_referencias_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE UNIQUE INDEX "documentos_manuales_empresaId_id_key" ON "documentos_manuales"("empresaId", "id");
CREATE INDEX "documentos_manuales_empresaId_idx" ON "documentos_manuales"("empresaId");
CREATE INDEX "documentos_manuales_entidadId_idx" ON "documentos_manuales"("entidadId");
CREATE INDEX "documentos_manuales_claseDocumento_idx" ON "documentos_manuales"("claseDocumento");
CREATE INDEX "documentos_manuales_estado_idx" ON "documentos_manuales"("estado");
CREATE INDEX "documento_manual_lineas_documentoManualId_idx" ON "documento_manual_lineas"("documentoManualId");
CREATE INDEX "documento_manual_lineas_articuloId_idx" ON "documento_manual_lineas"("articuloId");
CREATE INDEX "documento_manual_referencias_documentoManualId_idx" ON "documento_manual_referencias"("documentoManualId");

-- FKs
ALTER TABLE "documentos_manuales" ADD CONSTRAINT "documentos_manuales_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documentos_manuales" ADD CONSTRAINT "documentos_manuales_empresaId_entidadId_fkey" FOREIGN KEY ("empresaId", "entidadId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documentos_manuales" ADD CONSTRAINT "documentos_manuales_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documentos_manuales" ADD CONSTRAINT "documentos_manuales_empresaId_condicionPagoId_fkey" FOREIGN KEY ("empresaId", "condicionPagoId") REFERENCES "condiciones_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documentos_manuales" ADD CONSTRAINT "documentos_manuales_empresaId_guiaTransporteId_fkey" FOREIGN KEY ("empresaId", "guiaTransporteId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documento_manual_lineas" ADD CONSTRAINT "documento_manual_lineas_documentoManualId_fkey" FOREIGN KEY ("documentoManualId") REFERENCES "documentos_manuales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documento_manual_lineas" ADD CONSTRAINT "documento_manual_lineas_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documento_manual_referencias" ADD CONSTRAINT "documento_manual_referencias_documentoManualId_fkey" FOREIGN KEY ("documentoManualId") REFERENCES "documentos_manuales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
