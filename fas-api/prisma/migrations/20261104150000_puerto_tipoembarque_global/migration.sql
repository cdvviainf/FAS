-- ============================================================================
-- Puerto y TipoEmbarque pasan a ser GLOBALES (transversales a empresas),
-- igual que Pais (2026-11-04). Se les quita empresaId, se deduplican por código
-- (se conserva el de menor id) y se repuntan todas las referencias al que queda.
-- ============================================================================

-- 1) Quitar las FK que bloquearían el dedup/repunte (se recrean simples al final).
ALTER TABLE "embarques"       DROP CONSTRAINT "embarques_empresaId_puertoZarpeId_fkey";
ALTER TABLE "notas_venta"     DROP CONSTRAINT "notas_venta_empresaId_puertoDestinoId_fkey";
ALTER TABLE "notas_venta"     DROP CONSTRAINT "notas_venta_empresaId_tipoEmbarqueId_fkey";
ALTER TABLE "prefijos_codigo" DROP CONSTRAINT "prefijos_codigo_empresaId_tipoEmbarqueId_fkey";
ALTER TABLE "puertos"         DROP CONSTRAINT "puertos_empresaId_tipoEmbarqueId_fkey";
ALTER TABLE "puertos"         DROP CONSTRAINT "puertos_empresaId_fkey";
ALTER TABLE "tipos_embarque"  DROP CONSTRAINT "tipos_embarque_empresaId_fkey";

-- 2) DEDUP TipoEmbarque: entre los ACTIVOS (eliminadoEn IS NULL), por código, se
--    conserva el de menor id; se repuntan sus referers y se borran los demás.
CREATE TEMP TABLE _te_map AS
  SELECT t.id AS old_id, k.keep_id
  FROM "tipos_embarque" t
  JOIN (
    SELECT codigo, MIN(id) AS keep_id
    FROM "tipos_embarque"
    WHERE "eliminadoEn" IS NULL
    GROUP BY codigo
  ) k ON k.codigo = t.codigo
  WHERE t."eliminadoEn" IS NULL AND t.id <> k.keep_id;

UPDATE "puertos"         p  SET "tipoEmbarqueId" = m.keep_id FROM _te_map m WHERE p."tipoEmbarqueId"  = m.old_id;
UPDATE "notas_venta"     nv SET "tipoEmbarqueId" = m.keep_id FROM _te_map m WHERE nv."tipoEmbarqueId" = m.old_id;
UPDATE "prefijos_codigo" pc SET "tipoEmbarqueId" = m.keep_id FROM _te_map m WHERE pc."tipoEmbarqueId" = m.old_id;
DELETE FROM "tipos_embarque" t USING _te_map m WHERE t.id = m.old_id;

-- 3) DEDUP Puerto: mismo criterio (ya se repuntaron los tipoEmbarqueId arriba).
CREATE TEMP TABLE _pto_map AS
  SELECT p.id AS old_id, k.keep_id
  FROM "puertos" p
  JOIN (
    SELECT codigo, MIN(id) AS keep_id
    FROM "puertos"
    WHERE "eliminadoEn" IS NULL
    GROUP BY codigo
  ) k ON k.codigo = p.codigo
  WHERE p."eliminadoEn" IS NULL AND p.id <> k.keep_id;

UPDATE "embarques"          e  SET "puertoZarpeId"   = m.keep_id FROM _pto_map m WHERE e."puertoZarpeId"   = m.old_id;
UPDATE "notas_venta"        nv SET "puertoDestinoId" = m.keep_id FROM _pto_map m WHERE nv."puertoDestinoId" = m.old_id;
UPDATE "entidad_direcciones" d SET "puertoId"        = m.keep_id FROM _pto_map m WHERE d."puertoId"        = m.old_id;
DELETE FROM "puertos" p USING _pto_map m WHERE p.id = m.old_id;

DROP TABLE _te_map;
DROP TABLE _pto_map;

-- 4) Quitar índices por-empresa (únicos de código, único (empresaId,id), índices empresaId).
DROP INDEX "puertos_empresa_codigo_activo_key";
DROP INDEX "puertos_empresaId_id_key";
DROP INDEX "puertos_empresaId_idx";
DROP INDEX "tipos_embarque_empresa_codigo_activo_key";
DROP INDEX "tipos_embarque_empresaId_id_key";
DROP INDEX "tipos_embarque_empresaId_idx";

-- 5) Quitar la columna empresaId.
ALTER TABLE "puertos"        DROP COLUMN "empresaId";
ALTER TABLE "tipos_embarque" DROP COLUMN "empresaId";

-- 6) Unicidad GLOBAL de código (parcial, solo activos) — igual que paises.
CREATE UNIQUE INDEX "puertos_codigo_activo_idx"        ON "puertos"("codigo")        WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "tipos_embarque_codigo_activo_idx" ON "tipos_embarque"("codigo") WHERE "eliminadoEn" IS NULL;

-- 7) Índice de la nueva FK simple Puerto -> TipoEmbarque.
CREATE INDEX "puertos_tipoEmbarqueId_idx" ON "puertos"("tipoEmbarqueId");

-- 8) Recrear las FKs como SIMPLES (por id).
ALTER TABLE "puertos"         ADD CONSTRAINT "puertos_tipoEmbarqueId_fkey"         FOREIGN KEY ("tipoEmbarqueId")  REFERENCES "tipos_embarque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prefijos_codigo" ADD CONSTRAINT "prefijos_codigo_tipoEmbarqueId_fkey" FOREIGN KEY ("tipoEmbarqueId")  REFERENCES "tipos_embarque"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notas_venta"     ADD CONSTRAINT "notas_venta_tipoEmbarqueId_fkey"     FOREIGN KEY ("tipoEmbarqueId")  REFERENCES "tipos_embarque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notas_venta"     ADD CONSTRAINT "notas_venta_puertoDestinoId_fkey"    FOREIGN KEY ("puertoDestinoId") REFERENCES "puertos"("id")        ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "embarques"       ADD CONSTRAINT "embarques_puertoZarpeId_fkey"        FOREIGN KEY ("puertoZarpeId")   REFERENCES "puertos"("id")        ON DELETE SET NULL ON UPDATE CASCADE;
