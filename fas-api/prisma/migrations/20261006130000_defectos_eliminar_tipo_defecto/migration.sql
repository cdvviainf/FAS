-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-10-06 · Simplificación del catálogo de defectos a 2 niveles
--
-- Se elimina el nivel TipoDefecto (confusión con GrupoDefecto): GrupoDefecto
-- pasa a ser el nivel raíz (mantenedor plano) y Defecto cuelga de él. Destructivo
-- y sin backfill — decisión de negocio (Christian): TipoDefecto no tiene datos
-- reales. El Reclamo no cambia (ya clasificaba/armaba líneas por GrupoDefecto).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "grupos_defecto" DROP CONSTRAINT "grupos_defecto_empresaId_tipoDefectoId_fkey";
ALTER TABLE "tipos_defecto" DROP CONSTRAINT "tipos_defecto_empresaId_fkey";

DROP INDEX "grupos_defecto_tipoDefectoId_idx";

ALTER TABLE "grupos_defecto" DROP COLUMN "tipoDefectoId";

DROP TABLE "tipos_defecto";
