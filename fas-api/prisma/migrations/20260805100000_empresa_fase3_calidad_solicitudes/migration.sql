-- Fase 3 multi-empresa, lote "Calidad": SolicitudInspeccion pasa a ser
-- por-empresa. Self-safe (nullable -> backfill -> NOT NULL) — mismo patrón
-- que los lotes anteriores (Docs/empresas.md §3). A diferencia de lotes
-- previos, el backfill NO asume AGROSAN a ciegas: cada solicitud ya tiene
-- una Temporada asociada (temporadaId), y Temporada ya es por-empresa desde
-- el lote 1 — se deriva el empresaId real desde ahí, más preciso que asumir
-- un valor fijo.

-- ── 1. Agregar empresaId nullable ───────────────────────────────────────────
ALTER TABLE "solicitudes_inspeccion" ADD COLUMN "empresaId" INTEGER;

-- ── 2. Backfill: empresaId derivado de la Temporada de cada solicitud ──────
UPDATE "solicitudes_inspeccion" si
SET "empresaId" = t."empresaId"
FROM "temporadas" t
WHERE t.id = si."temporadaId" AND si."empresaId" IS NULL;

-- ── 3. NOT NULL solo después del backfill ───────────────────────────────────
ALTER TABLE "solicitudes_inspeccion" ALTER COLUMN "empresaId" SET NOT NULL;

-- ── 4. FK simple a empresas + índice regular ────────────────────────────────
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "solicitudes_inspeccion_empresaId_idx" ON "solicitudes_inspeccion"("empresaId");

-- ── 5. Único (empresaId, id) en los 4 nuevos lados-padre de FK compuesta ───
-- Especie ya lo tiene desde el lote 1 (Config/Mantenedores).
CREATE UNIQUE INDEX "temporadas_empresaId_id_key" ON "temporadas"("empresaId", "id");
CREATE UNIQUE INDEX "entidades_empresaId_id_key" ON "entidades"("empresaId", "id");
CREATE UNIQUE INDEX "mercados_empresaId_id_key" ON "mercados"("empresaId", "id");
CREATE UNIQUE INDEX "calificaciones_empresaId_id_key" ON "calificaciones"("empresaId", "id");

-- ── 6. FK compuestas: 6 relaciones tenant->tenant de este lote ──────────────
-- Mismo patrón que Mercado↔GrupoMercado (Fase 2a) y el lote 1 — imposible a
-- nivel de BD que una SolicitudInspeccion quede en una empresa distinta a la
-- de sus referencias tenant, aunque una escritura anidada de Prisma bypasee
-- la extensión de tenancy.
ALTER TABLE "solicitudes_inspeccion" DROP CONSTRAINT "solicitudes_inspeccion_temporadaId_fkey";
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_empresaId_temporadaId_fkey" FOREIGN KEY ("empresaId", "temporadaId") REFERENCES "temporadas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "solicitudes_inspeccion" DROP CONSTRAINT "solicitudes_inspeccion_entidadProductorId_fkey";
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_empresaId_entidadProductorId_fkey" FOREIGN KEY ("empresaId", "entidadProductorId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "solicitudes_inspeccion" DROP CONSTRAINT "solicitudes_inspeccion_especieId_fkey";
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_empresaId_especieId_fkey" FOREIGN KEY ("empresaId", "especieId") REFERENCES "especies"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "solicitudes_inspeccion" DROP CONSTRAINT "solicitudes_inspeccion_mercadoId_fkey";
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_empresaId_mercadoId_fkey" FOREIGN KEY ("empresaId", "mercadoId") REFERENCES "mercados"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "solicitudes_inspeccion" DROP CONSTRAINT "solicitudes_inspeccion_clienteId_fkey";
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_empresaId_clienteId_fkey" FOREIGN KEY ("empresaId", "clienteId") REFERENCES "entidades"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "solicitudes_inspeccion" DROP CONSTRAINT "solicitudes_inspeccion_calificacionId_fkey";
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_empresaId_calificacionId_fkey" FOREIGN KEY ("empresaId", "calificacionId") REFERENCES "calificaciones"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
