-- Logo de marca por empresa, para el Encabezado de los documentos PDF
-- (Motor de Documentos, Etapa 4 §12). Tabla separada de Empresa — mismo
-- patrón que RecepcionAdjuntoContenido/DocumentoEmitido.pdf — para que las
-- queries normales de Empresa (listados, selector de header) no arrastren
-- el binario.
CREATE TABLE "empresa_logos" (
    "empresaId" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "datos" BYTEA NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPor" TEXT NOT NULL,

    CONSTRAINT "empresa_logos_pkey" PRIMARY KEY ("empresaId")
);

-- AddForeignKey
ALTER TABLE "empresa_logos" ADD CONSTRAINT "empresa_logos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
