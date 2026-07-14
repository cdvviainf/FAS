-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GERENCIA', 'COMPRAS', 'VENTAS', 'OPERACIONES', 'FINANZAS', 'CALIDAD');

-- CreateEnum
CREATE TYPE "MercadoType" AS ENUM ('SUDAMERICA', 'NORTEAMERICA', 'EUROPA', 'ASIA', 'OTRO');

-- CreateEnum
CREATE TYPE "OcEstado" AS ENUM ('BORRADOR', 'ENVIADA', 'APROBADA', 'RECIBIDA_PARCIAL', 'RECIBIDA_TOTAL', 'ANULADA');

-- CreateEnum
CREATE TYPE "TipoPago" AS ENUM ('TRANSFERENCIA', 'CHEQUE', 'EFECTIVO', 'OTRO');

-- CreateEnum
CREATE TYPE "CalidadEstado" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'APROBADO_CONDICIONADO');

-- CreateEnum
CREATE TYPE "MovimientoTipo" AS ENUM ('INGRESO', 'DESPACHO_EXPORTACION', 'MERMA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "NvEstado" AS ENUM ('BORRADOR', 'CONFIRMADA', 'EMBARCADA', 'EN_TRANSITO', 'ENTREGADA', 'LIQUIDADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "CobranzaEstado" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADA', 'VENCIDA', 'INCOBRABLE');

-- CreateEnum
CREATE TYPE "DteEstado" AS ENUM ('PENDIENTE', 'ENVIADO', 'ACEPTADO', 'RECHAZADO', 'ANULADO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Productor" (
    "id" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "comuna" TEXT,
    "region" TEXT,
    "banco" TEXT,
    "tipoCuenta" TEXT,
    "numeroCuenta" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Productor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "pais" TEXT NOT NULL,
    "mercado" "MercadoType" NOT NULL,
    "email" TEXT,
    "contacto" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Especie" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Especie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variedad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "especieId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Variedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "productorId" TEXT NOT NULL,
    "temporada" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaEntrega" TIMESTAMP(3),
    "estado" "OcEstado" NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,
    "montoTotal" DECIMAL(18,4) NOT NULL,
    "aprobadoPor" TEXT,
    "aprobadoAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompraItem" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "variedadId" TEXT NOT NULL,
    "calibre" TEXT,
    "categoria" TEXT,
    "unidad" TEXT NOT NULL DEFAULT 'CAJA',
    "cantidadPactada" DECIMAL(18,4) NOT NULL,
    "precioUnitario" DECIMAL(18,4) NOT NULL,
    "montoTotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "OrdenCompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoProductor" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(18,4) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CLP',
    "tipoPago" "TipoPago" NOT NULL,
    "referencia" TEXT,
    "observaciones" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoProductor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLote" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "ordenCompraId" TEXT,
    "variedadId" TEXT NOT NULL,
    "temporada" TEXT NOT NULL,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL,
    "calibre" TEXT,
    "categoria" TEXT,
    "cantidadCajas" DECIMAL(18,4) NOT NULL,
    "pesoNeto" DECIMAL(18,4),
    "estadoCalidad" "CalidadEstado" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovimiento" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "tipo" "MovimientoTipo" NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "referencia" TEXT,
    "observaciones" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "precioUnitario" DECIMAL(18,4) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaVenta" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaEmbarque" TIMESTAMP(3),
    "mercado" "MercadoType" NOT NULL,
    "puertoDestino" TEXT,
    "incoterm" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "estado" "NvEstado" NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,
    "montoTotal" DECIMAL(18,4) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "NotaVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaVentaItem" (
    "id" TEXT NOT NULL,
    "notaVentaId" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "precioUnitario" DECIMAL(18,4) NOT NULL,
    "montoTotal" DECIMAL(18,4) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "NotaVentaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobranza" (
    "id" TEXT NOT NULL,
    "notaVentaId" TEXT NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(18,4) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "estado" "CobranzaEstado" NOT NULL DEFAULT 'PENDIENTE',
    "fechaPago" TIMESTAMP(3),
    "montoPagado" DECIMAL(18,4),
    "referencia" TEXT,
    "observaciones" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cobranza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostoOperacional" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(18,4) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "fecha" TIMESTAMP(3) NOT NULL,
    "referencia" TEXT,
    "notaVentaId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostoOperacional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoDTE" (
    "id" TEXT NOT NULL,
    "notaVentaId" TEXT,
    "tipoDTE" INTEGER NOT NULL,
    "folio" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL,
    "rutEmisor" TEXT NOT NULL,
    "rutReceptor" TEXT NOT NULL,
    "montoNeto" DECIMAL(18,4) NOT NULL,
    "montoIva" DECIMAL(18,4) NOT NULL,
    "montoTotal" DECIMAL(18,4) NOT NULL,
    "estado" "DteEstado" NOT NULL DEFAULT 'PENDIENTE',
    "proveedorRef" TEXT,
    "xmlTimbrado" TEXT,
    "pdfUrl" TEXT,
    "errorMensaje" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoDTE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspeccionCalidad" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "inspector" TEXT NOT NULL,
    "temperatura" DECIMAL(5,2),
    "brix" DECIMAL(5,2),
    "firmeza" TEXT,
    "coloracion" TEXT,
    "presenciaPlagas" BOOLEAN NOT NULL DEFAULT false,
    "resultado" "CalidadEstado" NOT NULL,
    "observaciones" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspeccionCalidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Productor_rut_key" ON "Productor"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_codigo_key" ON "Cliente"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Especie_nombre_key" ON "Especie"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Variedad_nombre_especieId_key" ON "Variedad"("nombre", "especieId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_numero_key" ON "OrdenCompra"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "StockLote_codigo_key" ON "StockLote"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Material_codigo_key" ON "Material"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "NotaVenta_numero_key" ON "NotaVenta"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "InspeccionCalidad_loteId_key" ON "InspeccionCalidad"("loteId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variedad" ADD CONSTRAINT "Variedad_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "Especie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_productorId_fkey" FOREIGN KEY ("productorId") REFERENCES "Productor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraItem" ADD CONSTRAINT "OrdenCompraItem_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraItem" ADD CONSTRAINT "OrdenCompraItem_variedadId_fkey" FOREIGN KEY ("variedadId") REFERENCES "Variedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoProductor" ADD CONSTRAINT "PagoProductor_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLote" ADD CONSTRAINT "StockLote_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLote" ADD CONSTRAINT "StockLote_variedadId_fkey" FOREIGN KEY ("variedadId") REFERENCES "Variedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovimiento" ADD CONSTRAINT "StockMovimiento_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "StockLote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaVenta" ADD CONSTRAINT "NotaVenta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaVentaItem" ADD CONSTRAINT "NotaVentaItem_notaVentaId_fkey" FOREIGN KEY ("notaVentaId") REFERENCES "NotaVenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaVentaItem" ADD CONSTRAINT "NotaVentaItem_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "StockLote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranza" ADD CONSTRAINT "Cobranza_notaVentaId_fkey" FOREIGN KEY ("notaVentaId") REFERENCES "NotaVenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoDTE" ADD CONSTRAINT "DocumentoDTE_notaVentaId_fkey" FOREIGN KEY ("notaVentaId") REFERENCES "NotaVenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
