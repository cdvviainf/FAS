-- Revisión 2026-11-05: Notify/Consignatario de un Cliente Extranjero pasan de
-- "contacto con categoría" a relación Entidad→Entidad (EntidadRelacionCliente).
-- El contacto conserva solo el flag de Comprador (esComprador).
-- El propio cliente actúa como Notify/Consignatario si tiene ese TipoEntidad
-- (no se guarda fila para sí mismo).

-- CreateEnum
CREATE TYPE "RolRelacionCliente" AS ENUM ('NOTIFY', 'CONSIGNATARIO');

-- CreateTable
CREATE TABLE "entidad_relaciones_cliente" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "rol" "RolRelacionCliente" NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entidad_relaciones_cliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "entidad_relaciones_cliente_clienteId_rol_entidadId_key" ON "entidad_relaciones_cliente"("clienteId", "rol", "entidadId");
CREATE INDEX "entidad_relaciones_cliente_entidadId_idx" ON "entidad_relaciones_cliente"("entidadId");

ALTER TABLE "entidad_relaciones_cliente" ADD CONSTRAINT "entidad_relaciones_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entidad_relaciones_cliente" ADD CONSTRAINT "entidad_relaciones_cliente_entidadId_fkey" FOREIGN KEY ("entidadId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill 1: contactos NOTIFY/CONSIGNATARIO vinculados → relaciones del cliente.
-- Orden: el contacto "por defecto" primero, luego por código de contacto.
INSERT INTO "entidad_relaciones_cliente" ("clienteId", "entidadId", "rol", "orden")
SELECT x."clienteId", x."entidadId", x."rol", x.orden
FROM (
  SELECT c."entidadId" AS "clienteId", c."entidadVinculadaId" AS "entidadId", r.rol::"RolRelacionCliente" AS "rol",
         ROW_NUMBER() OVER (
           PARTITION BY c."entidadId", r.rol, c."entidadVinculadaId" ORDER BY c.id
         ) AS dup,
         DENSE_RANK() OVER (
           PARTITION BY c."entidadId", r.rol
           ORDER BY (r.rol::text::"CategoriaContacto" = ANY(c."categoriasPorDefecto")) DESC, c."codigo", c.id
         ) - 1 AS orden
  FROM "entidad_contactos" c
  CROSS JOIN (VALUES ('NOTIFY'), ('CONSIGNATARIO')) AS r(rol)
  WHERE c."eliminadoEn" IS NULL
    AND c."entidadVinculadaId" IS NOT NULL
    AND c."entidadVinculadaId" <> c."entidadId"
    AND r.rol::"CategoriaContacto" = ANY(c."categorias")
) x
WHERE x.dup = 1
ON CONFLICT ("clienteId", "rol", "entidadId") DO NOTHING;

-- Backfill 2: todo Cliente Extranjero debe tener al menos un Notify y un
-- Consignatario. Si no tiene ninguna relación en un rol, actúa él mismo como
-- tal → se le agrega el TipoEntidad correspondiente.
UPDATE "entidades" e SET "tipos" = array_append(e."tipos", 'NOTIFY'::"TipoEntidad")
WHERE e."eliminadoEn" IS NULL
  AND 'CLIENTE_EXTRANJERO' = ANY(e."tipos")
  AND NOT ('NOTIFY' = ANY(e."tipos"))
  AND NOT EXISTS (SELECT 1 FROM "entidad_relaciones_cliente" r WHERE r."clienteId" = e.id AND r."rol" = 'NOTIFY');

UPDATE "entidades" e SET "tipos" = array_append(e."tipos", 'CONSIGNATARIO'::"TipoEntidad")
WHERE e."eliminadoEn" IS NULL
  AND 'CLIENTE_EXTRANJERO' = ANY(e."tipos")
  AND NOT ('CONSIGNATARIO' = ANY(e."tipos"))
  AND NOT EXISTS (SELECT 1 FROM "entidad_relaciones_cliente" r WHERE r."clienteId" = e.id AND r."rol" = 'CONSIGNATARIO');

-- Comprador: flag simple.
ALTER TABLE "entidad_contactos" ADD COLUMN "esComprador" BOOLEAN NOT NULL DEFAULT false;
UPDATE "entidad_contactos" SET "esComprador" = true WHERE 'COMPRADOR' = ANY("categorias");

-- Quitar el modelo anterior (categorías + vínculo en el contacto).
DROP INDEX IF EXISTS "entidad_contactos_default_comprador_key";
DROP INDEX IF EXISTS "entidad_contactos_default_notify_key";
DROP INDEX IF EXISTS "entidad_contactos_default_consignatario_key";
DROP INDEX IF EXISTS "entidad_contactos_entidadVinculadaId_idx";
ALTER TABLE "entidad_contactos" DROP CONSTRAINT IF EXISTS "entidad_contactos_entidadVinculadaId_fkey";
ALTER TABLE "entidad_contactos" DROP COLUMN "categorias",
DROP COLUMN "categoriasPorDefecto",
DROP COLUMN "entidadVinculadaId";
DROP TYPE "CategoriaContacto";
