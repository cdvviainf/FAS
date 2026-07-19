-- Eliminar columnas legacy de User (rol y estado, gestionados ahora por Usuario/Perfil)
ALTER TABLE "User" DROP COLUMN IF EXISTS "role";
ALTER TABLE "User" DROP COLUMN IF EXISTS "active";
ALTER TABLE "User" DROP COLUMN IF EXISTS "deletedAt";

-- Eliminar enum legacy
DROP TYPE IF EXISTS "UserRole";

-- Crear enum NivelAcceso
CREATE TYPE "NivelAcceso" AS ENUM ('SIN_ACCESO', 'LECTURA', 'TOTAL');

-- Crear tabla items_menu
CREATE TABLE "items_menu" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "seccion" TEXT NOT NULL,
    "ruta" TEXT,
    "esAccion" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "items_menu_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "items_menu_codigo_key" ON "items_menu"("codigo");

-- Crear tabla perfiles
CREATE TABLE "perfiles" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id")
);

-- Índice parcial: codigo único entre no eliminados (RP1)
CREATE UNIQUE INDEX "perfiles_codigo_activo_key" ON "perfiles"("codigo") WHERE "eliminadoEn" IS NULL;

-- Crear tabla perfil_accesos
CREATE TABLE "perfil_accesos" (
    "id" SERIAL NOT NULL,
    "perfilId" INTEGER NOT NULL,
    "itemMenuId" INTEGER NOT NULL,
    "nivel" "NivelAcceso" NOT NULL DEFAULT 'SIN_ACCESO',

    CONSTRAINT "perfil_accesos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "perfil_accesos_perfilId_itemMenuId_key" ON "perfil_accesos"("perfilId", "itemMenuId");

-- Crear tabla usuarios
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT,
    "imagenUrl" TEXT,
    "perfilId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- Índice parcial: email único entre no eliminados (RU1)
CREATE UNIQUE INDEX "usuarios_email_activo_key" ON "usuarios"("email") WHERE "eliminadoEn" IS NULL;

-- Foreign keys
ALTER TABLE "perfil_accesos" ADD CONSTRAINT "perfil_accesos_perfilId_fkey"
    FOREIGN KEY ("perfilId") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "perfil_accesos" ADD CONSTRAINT "perfil_accesos_itemMenuId_fkey"
    FOREIGN KEY ("itemMenuId") REFERENCES "items_menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_perfilId_fkey"
    FOREIGN KEY ("perfilId") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
