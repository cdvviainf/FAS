-- Solicitud de Inspección: especie por LÍNEA (2026-10-27)
-- Reestructura de cabecera+detalle: la especie, el embalaje, la variedad, las
-- categorías, los calibres, las calidades permitidas y la cantidad de pallets
-- pasan de la cabecera (campo único / listas planas) a una línea de producto.
-- Migración de datos best-effort: cada solicitud legacy con especie + al menos
-- una variedad + al menos un embalaje se convierte en UNA línea (primera
-- variedad/embalaje), con todas sus categorías/calibres/calidades y el
-- cantidadPallets de cabecera. Las que no cumplen quedan sin líneas (legacy).

-- ─── 1. Tablas nuevas ────────────────────────────────────────────────────────
CREATE TABLE "solicitud_inspeccion_lineas" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "especieId" INTEGER NOT NULL,
    "variedadId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "cantidadPallets" INTEGER,
    CONSTRAINT "solicitud_inspeccion_lineas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "solicitud_inspeccion_linea_categorias" (
    "id" SERIAL NOT NULL,
    "lineaId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    CONSTRAINT "solicitud_inspeccion_linea_categorias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "solicitud_inspeccion_linea_calibres" (
    "id" SERIAL NOT NULL,
    "lineaId" INTEGER NOT NULL,
    "calibreId" INTEGER NOT NULL,
    CONSTRAINT "solicitud_inspeccion_linea_calibres_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "solicitud_inspeccion_linea_calidades" (
    "id" SERIAL NOT NULL,
    "lineaId" INTEGER NOT NULL,
    "notaCalidadId" INTEGER NOT NULL,
    "notaCondicionId" INTEGER NOT NULL,
    CONSTRAINT "solicitud_inspeccion_linea_calidades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "solicitud_inspeccion_lineas_solicitudId_idx" ON "solicitud_inspeccion_lineas"("solicitudId");
CREATE INDEX "solicitud_inspeccion_lineas_especieId_idx" ON "solicitud_inspeccion_lineas"("especieId");
CREATE UNIQUE INDEX "solicitud_inspeccion_linea_categorias_lineaId_categoriaId_key" ON "solicitud_inspeccion_linea_categorias"("lineaId", "categoriaId");
CREATE UNIQUE INDEX "solicitud_inspeccion_linea_calibres_lineaId_calibreId_key" ON "solicitud_inspeccion_linea_calibres"("lineaId", "calibreId");
CREATE INDEX "solicitud_inspeccion_linea_calidades_lineaId_idx" ON "solicitud_inspeccion_linea_calidades"("lineaId");
CREATE UNIQUE INDEX "solicitud_inspeccion_linea_calidades_lineaId_notaCalidadId__key" ON "solicitud_inspeccion_linea_calidades"("lineaId", "notaCalidadId", "notaCondicionId");

ALTER TABLE "solicitud_inspeccion_lineas" ADD CONSTRAINT "solicitud_inspeccion_lineas_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_lineas" ADD CONSTRAINT "solicitud_inspeccion_lineas_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_lineas" ADD CONSTRAINT "solicitud_inspeccion_lineas_variedadId_fkey" FOREIGN KEY ("variedadId") REFERENCES "variedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_lineas" ADD CONSTRAINT "solicitud_inspeccion_lineas_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_linea_categorias" ADD CONSTRAINT "solicitud_inspeccion_linea_categorias_lineaId_fkey" FOREIGN KEY ("lineaId") REFERENCES "solicitud_inspeccion_lineas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_linea_categorias" ADD CONSTRAINT "solicitud_inspeccion_linea_categorias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_linea_calibres" ADD CONSTRAINT "solicitud_inspeccion_linea_calibres_lineaId_fkey" FOREIGN KEY ("lineaId") REFERENCES "solicitud_inspeccion_lineas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_linea_calibres" ADD CONSTRAINT "solicitud_inspeccion_linea_calibres_calibreId_fkey" FOREIGN KEY ("calibreId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_linea_calidades" ADD CONSTRAINT "solicitud_inspeccion_linea_calidades_lineaId_fkey" FOREIGN KEY ("lineaId") REFERENCES "solicitud_inspeccion_lineas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_linea_calidades" ADD CONSTRAINT "solicitud_inspeccion_linea_calidades_notaCalidadId_fkey" FOREIGN KEY ("notaCalidadId") REFERENCES "notas_calidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_linea_calidades" ADD CONSTRAINT "solicitud_inspeccion_linea_calidades_notaCondicionId_fkey" FOREIGN KEY ("notaCondicionId") REFERENCES "notas_condicion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 2. Migración de datos legacy (best-effort, 1 línea por solicitud) ────────
INSERT INTO "solicitud_inspeccion_lineas" ("solicitudId", "especieId", "variedadId", "articuloId", "cantidadPallets")
SELECT s."id", s."especieId",
    (SELECT MIN(v."variedadId") FROM "solicitud_inspeccion_variedades" v WHERE v."solicitudId" = s."id"),
    (SELECT MIN(e."articuloId") FROM "solicitud_inspeccion_embalajes" e WHERE e."solicitudId" = s."id"),
    s."cantidadPallets"
FROM "solicitudes_inspeccion" s
WHERE s."especieId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "solicitud_inspeccion_variedades" v WHERE v."solicitudId" = s."id")
  AND EXISTS (SELECT 1 FROM "solicitud_inspeccion_embalajes" e WHERE e."solicitudId" = s."id");

INSERT INTO "solicitud_inspeccion_linea_categorias" ("lineaId", "categoriaId")
SELECT l."id", c."categoriaId"
FROM "solicitud_inspeccion_lineas" l
JOIN "solicitud_inspeccion_categorias" c ON c."solicitudId" = l."solicitudId";

INSERT INTO "solicitud_inspeccion_linea_calibres" ("lineaId", "calibreId")
SELECT l."id", cal."calibreId"
FROM "solicitud_inspeccion_lineas" l
JOIN "solicitud_inspeccion_calibres" cal ON cal."solicitudId" = l."solicitudId";

INSERT INTO "solicitud_inspeccion_linea_calidades" ("lineaId", "notaCalidadId", "notaCondicionId")
SELECT l."id", q."notaCalidadId", q."notaCondicionId"
FROM "solicitud_inspeccion_lineas" l
JOIN "solicitud_inspeccion_calidades_permitidas" q ON q."solicitudId" = l."solicitudId";

-- ─── 3. Baja de las estructuras de cabecera reemplazadas ─────────────────────
DROP TABLE "solicitud_inspeccion_variedades";
DROP TABLE "solicitud_inspeccion_calibres";
DROP TABLE "solicitud_inspeccion_categorias";
DROP TABLE "solicitud_inspeccion_embalajes";
DROP TABLE "solicitud_inspeccion_calidades_permitidas";

-- DROP COLUMN cascada la FK solicitudes_inspeccion_empresaId_especieId_fkey.
ALTER TABLE "solicitudes_inspeccion" DROP COLUMN "especieId", DROP COLUMN "cantidadPallets";
