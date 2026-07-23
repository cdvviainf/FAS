-- CreateEnum
CREATE TYPE "EstadoSolicitudInspeccion" AS ENUM ('PENDIENTE', 'NOTIFICADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "FuncionAsignadoInspeccion" AS ENUM ('ACUDIR', 'NOTIFICAR');

-- AlterTable
ALTER TABLE "entidad_direcciones" ADD COLUMN     "latitud" DECIMAL(10,7),
ADD COLUMN     "longitud" DECIMAL(10,7);

-- CreateTable
CREATE TABLE "motivos_inspeccion" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "descripcionExtranjera" TEXT,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "motivos_inspeccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_inspeccion" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "temporadaId" INTEGER NOT NULL,
    "entidadProductorId" INTEGER NOT NULL,
    "direccionId" INTEGER NOT NULL,
    "especieId" INTEGER,
    "fechaHora" TIMESTAMP(3) NOT NULL,
    "motivoId" INTEGER NOT NULL,
    "observaciones" TEXT,
    "estado" "EstadoSolicitudInspeccion" NOT NULL DEFAULT 'PENDIENTE',
    "notificadaEn" TIMESTAMP(3),
    "recordatorioEnviadoEn" TIMESTAMP(3),
    "comentariosCierre" TEXT,
    "fechaCierre" TIMESTAMP(3),
    "cerradaPor" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "solicitudes_inspeccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_inspeccion_asignados" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "funcion" "FuncionAsignadoInspeccion" NOT NULL,

    CONSTRAINT "solicitud_inspeccion_asignados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_inspeccion_adjuntos" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "etapa" TEXT NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPor" TEXT NOT NULL,

    CONSTRAINT "solicitud_inspeccion_adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_inspeccion_adjuntos_contenido" (
    "adjuntoId" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,

    CONSTRAINT "solicitud_inspeccion_adjuntos_contenido_pkey" PRIMARY KEY ("adjuntoId")
);

-- CreateTable
CREATE TABLE "configuracion_correo" (
    "id" SERIAL NOT NULL,
    "host" TEXT NOT NULL,
    "puerto" INTEGER NOT NULL DEFAULT 587,
    "seguridad" TEXT NOT NULL DEFAULT 'STARTTLS',
    "usuario" TEXT NOT NULL,
    "passwordCifrada" TEXT NOT NULL,
    "remitenteNombre" TEXT NOT NULL,
    "remitenteEmail" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,

    CONSTRAINT "configuracion_correo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_inspeccion_estado_idx" ON "solicitudes_inspeccion"("estado");

-- CreateIndex
CREATE INDEX "solicitudes_inspeccion_entidadProductorId_idx" ON "solicitudes_inspeccion"("entidadProductorId");

-- CreateIndex
CREATE INDEX "solicitudes_inspeccion_eliminadoEn_idx" ON "solicitudes_inspeccion"("eliminadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_inspeccion_temporadaId_numero_key" ON "solicitudes_inspeccion"("temporadaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_inspeccion_asignados_solicitudId_usuarioId_key" ON "solicitud_inspeccion_asignados"("solicitudId", "usuarioId");

-- CreateIndex
CREATE INDEX "solicitud_inspeccion_adjuntos_solicitudId_idx" ON "solicitud_inspeccion_adjuntos"("solicitudId");

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_temporadaId_fkey" FOREIGN KEY ("temporadaId") REFERENCES "temporadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_entidadProductorId_fkey" FOREIGN KEY ("entidadProductorId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_direccionId_fkey" FOREIGN KEY ("direccionId") REFERENCES "entidad_direcciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES "motivos_inspeccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_asignados" ADD CONSTRAINT "solicitud_inspeccion_asignados_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_asignados" ADD CONSTRAINT "solicitud_inspeccion_asignados_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_adjuntos" ADD CONSTRAINT "solicitud_inspeccion_adjuntos_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_adjuntos_contenido" ADD CONSTRAINT "solicitud_inspeccion_adjuntos_contenido_adjuntoId_fkey" FOREIGN KEY ("adjuntoId") REFERENCES "solicitud_inspeccion_adjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
