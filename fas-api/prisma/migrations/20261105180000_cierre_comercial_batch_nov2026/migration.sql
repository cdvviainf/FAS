-- Batch Cierre Comercial (2026-11-05)
--  * Calidad/Condición "hasta" en NotaVenta (supersede pares NotaVentaCalidadPermitida)
--  * orden en NotaCalidad/NotaCondicion
--  * Responsable de venta en NotaVenta + firma de usuario (UsuarioFirma)
--  * calibreModo en NotaVentaDetalle
--  * Articulo.descripcionComercial
--  * Categorías comerciales de contacto (Comprador/Notify/Consignatario)

-- CreateEnum
CREATE TYPE "CategoriaContacto" AS ENUM ('COMPRADOR', 'NOTIFY', 'CONSIGNATARIO');
CREATE TYPE "CalibreModo" AS ENUM ('ESPECIFICOS', 'RANGO');

-- AlterTable
ALTER TABLE "entidad_contactos" ADD COLUMN "categorias" "CategoriaContacto"[] NOT NULL DEFAULT ARRAY[]::"CategoriaContacto"[],
ADD COLUMN "categoriasPorDefecto" "CategoriaContacto"[] NOT NULL DEFAULT ARRAY[]::"CategoriaContacto"[],
ADD COLUMN "entidadVinculadaId" INTEGER;

ALTER TABLE "articulos" ADD COLUMN "descripcionComercial" TEXT;

ALTER TABLE "notas_calidad" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "notas_condicion" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "notas_venta" ADD COLUMN "notaCalidadHastaId" INTEGER,
ADD COLUMN "notaCondicionHastaId" INTEGER,
ADD COLUMN "responsableVentaId" TEXT;

ALTER TABLE "notas_venta_detalle" ADD COLUMN "calibreModo" "CalibreModo" NOT NULL DEFAULT 'ESPECIFICOS';

-- Backfill orden: escala por codigo dentro de cada empresa (A<B<C, 1<2<10).
-- Orden natural (CCN26-R1, QA ronda 1): los códigos numéricos se ordenan
-- como números y antes que los alfabéticos; el resto, como texto.
-- Revisar en cada ambiente que el orden resultante sea el de negocio.
UPDATE "notas_calidad" n SET "orden" = x.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "empresaId"
    ORDER BY ("codigo" !~ '^[0-9]+$'), CASE WHEN "codigo" ~ '^[0-9]+$' THEN "codigo"::numeric END, "codigo", id
  ) AS rn FROM "notas_calidad"
) x
WHERE n.id = x.id;
UPDATE "notas_condicion" n SET "orden" = x.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "empresaId"
    ORDER BY ("codigo" !~ '^[0-9]+$'), CASE WHEN "codigo" ~ '^[0-9]+$' THEN "codigo"::numeric END, "codigo", id
  ) AS rn FROM "notas_condicion"
) x
WHERE n.id = x.id;

-- Backfill "hasta" desde los pares existentes: la calidad de mayor orden y la
-- condición de mayor orden presentes en los pares del Cierre.
UPDATE "notas_venta" nv SET "notaCalidadHastaId" = x."notaCalidadId"
FROM (
  SELECT DISTINCT ON (p."notaVentaId") p."notaVentaId", p."notaCalidadId"
  FROM "nota_venta_calidades_permitidas" p JOIN "notas_calidad" c ON c.id = p."notaCalidadId"
  ORDER BY p."notaVentaId", c."orden" DESC, c.id DESC
) x WHERE nv.id = x."notaVentaId";
UPDATE "notas_venta" nv SET "notaCondicionHastaId" = x."notaCondicionId"
FROM (
  SELECT DISTINCT ON (p."notaVentaId") p."notaVentaId", p."notaCondicionId"
  FROM "nota_venta_calidades_permitidas" p JOIN "notas_condicion" c ON c.id = p."notaCondicionId"
  ORDER BY p."notaVentaId", c."orden" DESC, c.id DESC
) x WHERE nv.id = x."notaVentaId";

-- Backfill responsable de venta = creador (si es un usuario existente).
UPDATE "notas_venta" nv SET "responsableVentaId" = nv."creadoPor"
WHERE EXISTS (SELECT 1 FROM "usuarios" u WHERE u.id = nv."creadoPor");

-- Backfill categoría COMPRADOR para contactos ya usados como comprador en un Cierre.
UPDATE "entidad_contactos" c SET "categorias" = ARRAY['COMPRADOR']::"CategoriaContacto"[]
WHERE EXISTS (SELECT 1 FROM "notas_venta" nv WHERE nv."compradorContactoId" = c.id);

-- DropTable (pares superseded)
DROP TABLE "nota_venta_calidades_permitidas";

-- CreateTable
CREATE TABLE "usuarios_firma" (
    "usuarioId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuarios_firma_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateIndex
CREATE INDEX "entidad_contactos_entidadVinculadaId_idx" ON "entidad_contactos"("entidadVinculadaId");
CREATE INDEX "notas_venta_responsableVentaId_idx" ON "notas_venta"("responsableVentaId");

-- Un solo contacto por defecto por (entidad, categoría) entre los contactos
-- vigentes (CCN26-R1-001): enforcement en BD contra carreras concurrentes —
-- el service además libera el default anterior en la misma transacción.
-- Índices únicos parciales (Prisma no los modela; mismo criterio que otros
-- índices parciales del proyecto).
CREATE UNIQUE INDEX "entidad_contactos_default_comprador_key" ON "entidad_contactos"("entidadId")
  WHERE 'COMPRADOR' = ANY("categoriasPorDefecto") AND "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "entidad_contactos_default_notify_key" ON "entidad_contactos"("entidadId")
  WHERE 'NOTIFY' = ANY("categoriasPorDefecto") AND "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX "entidad_contactos_default_consignatario_key" ON "entidad_contactos"("entidadId")
  WHERE 'CONSIGNATARIO' = ANY("categoriasPorDefecto") AND "eliminadoEn" IS NULL;

-- AddForeignKey
ALTER TABLE "usuarios_firma" ADD CONSTRAINT "usuarios_firma_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entidad_contactos" ADD CONSTRAINT "entidad_contactos_entidadVinculadaId_fkey" FOREIGN KEY ("entidadVinculadaId") REFERENCES "entidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_responsableVentaId_fkey" FOREIGN KEY ("responsableVentaId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_notaCalidadHastaId_fkey" FOREIGN KEY ("empresaId", "notaCalidadHastaId") REFERENCES "notas_calidad"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_notaCondicionHastaId_fkey" FOREIGN KEY ("empresaId", "notaCondicionHastaId") REFERENCES "notas_condicion"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
