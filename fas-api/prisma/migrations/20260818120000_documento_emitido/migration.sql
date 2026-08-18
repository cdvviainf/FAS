-- Motor de Documentos — Etapa 4 (Docs/agrosan_etapa4_motor_documentos.md)
-- Migración escrita a mano en vez de generada con `prisma migrate dev`: el
-- diff automático contra la base local también arrastraba drift preexistente
-- no relacionado (columnas/constraints viejas de otros módulos) — se
-- extrajo solo el bloque de esta tabla nueva.

-- CreateTable
CREATE TABLE "documentos_emitidos" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "documentoId" INTEGER NOT NULL,
    "plantillaVersion" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "pdf" BYTEA NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,

    CONSTRAINT "documentos_emitidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentos_emitidos_tipo_documentoId_idx" ON "documentos_emitidos"("tipo", "documentoId");

-- AddForeignKey
ALTER TABLE "documentos_emitidos" ADD CONSTRAINT "documentos_emitidos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
