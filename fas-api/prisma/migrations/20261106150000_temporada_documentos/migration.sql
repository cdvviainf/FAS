-- Temporada en documentos raíz (2026-11-06, QA/plan-temporada-listados-nov2026.md).
-- Cierre Comercial (notas_venta), OC de fruta (ordenes_compra), Instructivo de
-- Embalaje y Recepción. Embarques heredan de la NV; Pallets/Stock de la Recepción.

ALTER TABLE "notas_venta" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "ordenes_compra" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "instructivos_embalaje" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "recepciones" ADD COLUMN "temporadaId" INTEGER;

CREATE INDEX "notas_venta_temporadaId_idx" ON "notas_venta"("temporadaId");
CREATE INDEX "ordenes_compra_temporadaId_idx" ON "ordenes_compra"("temporadaId");
CREATE INDEX "instructivos_embalaje_temporadaId_idx" ON "instructivos_embalaje"("temporadaId");
CREATE INDEX "recepciones_temporadaId_idx" ON "recepciones"("temporadaId");

ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_temporadaId_fkey" FOREIGN KEY ("empresaId", "temporadaId") REFERENCES "temporadas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_temporadaId_fkey" FOREIGN KEY ("empresaId", "temporadaId") REFERENCES "temporadas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instructivos_embalaje" ADD CONSTRAINT "instructivos_embalaje_empresaId_temporadaId_fkey" FOREIGN KEY ("empresaId", "temporadaId") REFERENCES "temporadas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_empresaId_temporadaId_fkey" FOREIGN KEY ("empresaId", "temporadaId") REFERENCES "temporadas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Backfill ────────────────────────────────────────────────────────────────
-- Decisión del usuario (2026-11-06): todos los documentos existentes son de
-- prueba → se asignan a la temporada "25-26" de SU empresa (código exacto, no
-- eliminada). Si una empresa no tuviera "25-26", cae a su predeterminada; si
-- tampoco hay, queda NULL. Los documentos nuevos toman la temporada activa.

UPDATE "notas_venta" n SET "temporadaId" = (
  SELECT t."id" FROM "temporadas" t
  WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."codigo" = '25-26'
  ORDER BY t."id" LIMIT 1
);
UPDATE "notas_venta" n SET "temporadaId" = (
  SELECT t."id" FROM "temporadas" t
  WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."predeterminada" = true
  ORDER BY t."id" DESC LIMIT 1
)
WHERE n."temporadaId" IS NULL;

UPDATE "ordenes_compra" n SET "temporadaId" = (
  SELECT t."id" FROM "temporadas" t
  WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."codigo" = '25-26'
  ORDER BY t."id" LIMIT 1
);
UPDATE "ordenes_compra" n SET "temporadaId" = (
  SELECT t."id" FROM "temporadas" t
  WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."predeterminada" = true
  ORDER BY t."id" DESC LIMIT 1
)
WHERE n."temporadaId" IS NULL;

UPDATE "instructivos_embalaje" n SET "temporadaId" = (
  SELECT t."id" FROM "temporadas" t
  WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."codigo" = '25-26'
  ORDER BY t."id" LIMIT 1
);
UPDATE "instructivos_embalaje" n SET "temporadaId" = (
  SELECT t."id" FROM "temporadas" t
  WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."predeterminada" = true
  ORDER BY t."id" DESC LIMIT 1
)
WHERE n."temporadaId" IS NULL;

UPDATE "recepciones" n SET "temporadaId" = (
  SELECT t."id" FROM "temporadas" t
  WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."codigo" = '25-26'
  ORDER BY t."id" LIMIT 1
);
UPDATE "recepciones" n SET "temporadaId" = (
  SELECT t."id" FROM "temporadas" t
  WHERE t."empresaId" = n."empresaId" AND t."eliminadoEn" IS NULL AND t."predeterminada" = true
  ORDER BY t."id" DESC LIMIT 1
)
WHERE n."temporadaId" IS NULL;
