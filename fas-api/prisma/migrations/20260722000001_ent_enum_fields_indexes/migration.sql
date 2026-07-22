-- QA-ENT-002: Agregar PLANTA al enum TipoEntidad
ALTER TYPE "TipoEntidad" ADD VALUE IF NOT EXISTS 'PLANTA';

-- QA-ENT-004: Agregar rut y whatsapp a entidad_contactos
ALTER TABLE "entidad_contactos" ADD COLUMN IF NOT EXISTS "rut" TEXT;
ALTER TABLE "entidad_contactos" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT;

-- QA-ENT-003: Indices unicos parciales (WHERE eliminadoEn IS NULL)

-- Entidades: codigo unico entre no eliminados
CREATE UNIQUE INDEX IF NOT EXISTS "ux_entidades_codigo"
  ON "entidades"("codigo") WHERE "eliminadoEn" IS NULL;

-- Entidades: identificador unico entre no eliminados cuando existe
CREATE UNIQUE INDEX IF NOT EXISTS "ux_entidades_identificador"
  ON "entidades"("identificador") WHERE "eliminadoEn" IS NULL AND "identificador" IS NOT NULL;

-- Direcciones: codigo unico por entidad entre no eliminados
CREATE UNIQUE INDEX IF NOT EXISTS "ux_entidad_direcciones_codigo"
  ON "entidad_direcciones"("entidadId", "codigo") WHERE "eliminadoEn" IS NULL;

-- Direcciones: maximo una por defecto por entidad entre no eliminados
CREATE UNIQUE INDEX IF NOT EXISTS "ux_entidad_direcciones_por_defecto"
  ON "entidad_direcciones"("entidadId") WHERE "eliminadoEn" IS NULL AND "esPorDefecto" = true;

-- Contactos: codigo unico por entidad entre no eliminados
CREATE UNIQUE INDEX IF NOT EXISTS "ux_entidad_contactos_codigo"
  ON "entidad_contactos"("entidadId", "codigo") WHERE "eliminadoEn" IS NULL;

-- Contactos: maximo un representante legal por entidad entre no eliminados
CREATE UNIQUE INDEX IF NOT EXISTS "ux_entidad_contactos_representante"
  ON "entidad_contactos"("entidadId") WHERE "eliminadoEn" IS NULL AND "esRepresentanteLegal" = true;
