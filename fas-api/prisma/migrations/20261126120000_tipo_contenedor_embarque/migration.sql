-- Tipo de Contenedor (2026-11-26): mantenedor GLOBAL (como TipoEmbarque/Puerto)
-- que reemplaza al Tipo de BL del Embarque — el Tipo de BL se define solo en
-- el Cierre Comercial. Para AGL360 se traduce vía Integraciones (maestro
-- TIPO_CONTENEDOR → IdTipoContenedor).

-- AlterEnum
ALTER TYPE "MaestroIntegracion" ADD VALUE 'TIPO_CONTENEDOR';

-- CreateTable
CREATE TABLE "tipos_contenedor" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "descripcionExtranjera" TEXT,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "tipos_contenedor_pkey" PRIMARY KEY ("id")
);

-- Código único entre los registros activos (mismo criterio que los demás mantenedores).
CREATE UNIQUE INDEX "tipos_contenedor_codigo_activo_key" ON "tipos_contenedor"("codigo") WHERE "eliminadoEn" IS NULL;

-- Vistas operativas (no gestionadas por Prisma) que dependen de
-- embarques.tipoBlId (ej. th_embarques): hay que eliminarlas antes de quitar la
-- columna — mismo criterio que 20261104150000_puerto_tipoembarque_global. Se
-- eliminan DINÁMICAMENTE, sin importar su nombre. Recréalas DESPUÉS del deploy
-- desde QA/vista_th_embarques.sql (reserva_tipo_bl → reserva_tipo_contenedor).
DO $$
DECLARE v text;
BEGIN
  FOR v IN
    SELECT DISTINCT dv.relname
    FROM pg_depend d
    JOIN pg_rewrite r  ON r.oid = d.objid
    JOIN pg_class   dv ON dv.oid = r.ev_class AND dv.relkind = 'v'
    JOIN pg_class   tc ON tc.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
    WHERE tc.relname = 'embarques' AND a.attname = 'tipoBlId'
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS %I CASCADE', v);
  END LOOP;
END $$;

-- Embarque: Tipo de BL → Tipo de Contenedor. El Tipo de BL del Embarque era
-- una copia editable del Cierre; el Cierre conserva el suyo (notas_venta.tipoBlId).
ALTER TABLE "embarques" DROP CONSTRAINT IF EXISTS "embarques_empresaId_tipoBlId_fkey";
ALTER TABLE "embarques" DROP COLUMN "tipoBlId";
ALTER TABLE "embarques" ADD COLUMN "tipoContenedorId" INTEGER;

CREATE INDEX "embarques_tipoContenedorId_idx" ON "embarques"("tipoContenedorId");

ALTER TABLE "embarques" ADD CONSTRAINT "embarques_tipoContenedorId_fkey" FOREIGN KEY ("tipoContenedorId") REFERENCES "tipos_contenedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ítem de menú (el seed NO corre en el deploy). Acceso inicial = el que cada
-- perfil tiene en Tipos de Embarque.
INSERT INTO "items_menu" ("codigo", "nombre", "grupo", "seccion", "ruta", "esAccion", "tipo", "orden")
VALUES
  ('CONFIG_TIPOS_CONTENEDOR', 'Tipos de Contenedor', 'Configuración', 'Gestión Comercial', '/dashboard/configuracion/tipos-contenedor', false, 'PANTALLA', 8145)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "grupo" = EXCLUDED."grupo",
  "seccion" = EXCLUDED."seccion",
  "ruta" = EXCLUDED."ruta",
  "esAccion" = EXCLUDED."esAccion",
  "tipo" = EXCLUDED."tipo",
  "orden" = EXCLUDED."orden";

INSERT INTO "perfil_accesos" ("perfilId", "itemMenuId", "nivel")
SELECT pa."perfilId", destino."id", pa."nivel"
FROM "perfil_accesos" pa
JOIN "items_menu" origen ON origen."id" = pa."itemMenuId" AND origen."codigo" = 'CONFIG_TIPOS_EMBARQUE'
JOIN "items_menu" destino ON destino."codigo" = 'CONFIG_TIPOS_CONTENEDOR'
ON CONFLICT ("perfilId", "itemMenuId") DO NOTHING;
