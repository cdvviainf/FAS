-- DOC-QA-003 (ronda 2, Etapa 4) — defensa en profundidad de idempotencia:
-- el mecanismo primario es el advisory lock de emisión
-- (LOCK_NAMESPACE_DOCUMENTOS_EMISION, documentos.repository.ts).

-- CreateIndex
CREATE UNIQUE INDEX "documentos_emitidos_empresaId_tipo_documentoId_plantillaVer_key" ON "documentos_emitidos"("empresaId", "tipo", "documentoId", "plantillaVersion", "hashSha256");
