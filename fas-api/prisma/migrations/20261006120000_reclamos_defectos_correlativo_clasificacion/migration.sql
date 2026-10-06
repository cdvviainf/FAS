-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-10-06 · Reclamos de Calidad + catálogo de defectos
--
-- 1) Catálogo de defectos: GrupoDefecto (cuelga de TipoDefecto) + Defecto
--    (cuelga de GrupoDefecto) + DefectoEspecie (validez por especie).
-- 2) Reclamo: correlativo propio `codigo` (PrefijoCodigo), clasificación
--    `grupoDefectoId` (GrupoDefecto, Calidad/Condición) y líneas de defecto
--    `ReclamoDefecto` (grupo + defecto + porcentaje).
--
-- `codigo` se agrega NULLABLE, se backfillea (REC + correlativo por empresa) y
-- recién entonces se vuelve NOT NULL — para no romper filas existentes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── TipoDefecto: @@unique necesario para la FK compuesta de GrupoDefecto ──────
CREATE UNIQUE INDEX "tipos_defecto_empresaId_id_key" ON "tipos_defecto"("empresaId", "id");

-- ── Catálogo: GrupoDefecto / Defecto / DefectoEspecie ─────────────────────────
CREATE TABLE "grupos_defecto" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "descripcionExtranjera" TEXT,
    "tipoDefectoId" INTEGER NOT NULL,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "grupos_defecto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "defectos" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "descripcionExtranjera" TEXT,
    "grupoDefectoId" INTEGER NOT NULL,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "defectos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "defectos_especie" (
    "id" SERIAL NOT NULL,
    "defectoId" INTEGER NOT NULL,
    "especieId" INTEGER NOT NULL,

    CONSTRAINT "defectos_especie_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "grupos_defecto_empresaId_idx" ON "grupos_defecto"("empresaId");
CREATE INDEX "grupos_defecto_tipoDefectoId_idx" ON "grupos_defecto"("tipoDefectoId");
CREATE UNIQUE INDEX "grupos_defecto_empresaId_id_key" ON "grupos_defecto"("empresaId", "id");
CREATE INDEX "defectos_empresaId_idx" ON "defectos"("empresaId");
CREATE INDEX "defectos_grupoDefectoId_idx" ON "defectos"("grupoDefectoId");
CREATE UNIQUE INDEX "defectos_empresaId_id_key" ON "defectos"("empresaId", "id");
CREATE INDEX "defectos_especie_defectoId_idx" ON "defectos_especie"("defectoId");
CREATE UNIQUE INDEX "defectos_especie_defectoId_especieId_key" ON "defectos_especie"("defectoId", "especieId");

ALTER TABLE "grupos_defecto" ADD CONSTRAINT "grupos_defecto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grupos_defecto" ADD CONSTRAINT "grupos_defecto_empresaId_tipoDefectoId_fkey" FOREIGN KEY ("empresaId", "tipoDefectoId") REFERENCES "tipos_defecto"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defectos" ADD CONSTRAINT "defectos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defectos" ADD CONSTRAINT "defectos_empresaId_grupoDefectoId_fkey" FOREIGN KEY ("empresaId", "grupoDefectoId") REFERENCES "grupos_defecto"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defectos_especie" ADD CONSTRAINT "defectos_especie_defectoId_fkey" FOREIGN KEY ("defectoId") REFERENCES "defectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "defectos_especie" ADD CONSTRAINT "defectos_especie_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Reclamo: clasificación grupoDefectoId + correlativo codigo ────────────────
ALTER TABLE "reclamos" ADD COLUMN "grupoDefectoId" INTEGER;
-- codigo primero NULLABLE para poder backfillear.
ALTER TABLE "reclamos" ADD COLUMN "codigo" TEXT;

-- Backfill: REC + correlativo de 4 dígitos por empresa (orden por id). El seed
-- crea PrefijoCodigo(modelo='reclamo', prefijo='REC', digitos=4); el service
-- continúa la numeración tomando el máximo sufijo existente.
WITH numerados AS (
  SELECT "id",
         'REC' || LPAD((ROW_NUMBER() OVER (PARTITION BY "empresaId" ORDER BY "id"))::text, 4, '0') AS nuevo_codigo
  FROM "reclamos"
)
UPDATE "reclamos" r SET "codigo" = n.nuevo_codigo FROM numerados n WHERE r."id" = n."id";

ALTER TABLE "reclamos" ALTER COLUMN "codigo" SET NOT NULL;

-- Unicidad real del correlativo: índice parcial por empresa entre filas activas
-- (mismo patrón que PrefijoCodigo/Entidad — no representable en el DSL Prisma).
CREATE UNIQUE INDEX "reclamos_empresaId_codigo_key" ON "reclamos"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;
CREATE INDEX "reclamos_grupoDefectoId_idx" ON "reclamos"("grupoDefectoId");

ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_empresaId_grupoDefectoId_fkey" FOREIGN KEY ("empresaId", "grupoDefectoId") REFERENCES "grupos_defecto"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Líneas de defecto del Reclamo ─────────────────────────────────────────────
CREATE TABLE "reclamo_defectos" (
    "id" SERIAL NOT NULL,
    "reclamoId" INTEGER NOT NULL,
    "grupoDefectoId" INTEGER NOT NULL,
    "defectoId" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "reclamo_defectos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reclamo_defectos_reclamoId_idx" ON "reclamo_defectos"("reclamoId");
CREATE INDEX "reclamo_defectos_grupoDefectoId_idx" ON "reclamo_defectos"("grupoDefectoId");
CREATE INDEX "reclamo_defectos_defectoId_idx" ON "reclamo_defectos"("defectoId");

ALTER TABLE "reclamo_defectos" ADD CONSTRAINT "reclamo_defectos_reclamoId_fkey" FOREIGN KEY ("reclamoId") REFERENCES "reclamos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reclamo_defectos" ADD CONSTRAINT "reclamo_defectos_grupoDefectoId_fkey" FOREIGN KEY ("grupoDefectoId") REFERENCES "grupos_defecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reclamo_defectos" ADD CONSTRAINT "reclamo_defectos_defectoId_fkey" FOREIGN KEY ("defectoId") REFERENCES "defectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
