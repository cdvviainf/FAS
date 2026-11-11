-- Visor de correos enviados (2026-11-11): un registro por destinatario, con
-- estado del envío y reintento por registro. + Auditoría pasa a Herramientas.
-- CreateEnum
CREATE TYPE "EstadoCorreoEnviado" AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO');

-- CreateTable
CREATE TABLE "correos_enviados" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "lote" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "origen" TEXT,
    "pdfTipo" TEXT,
    "pdfId" INTEGER,
    "estado" "EstadoCorreoEnviado" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "enviadoEn" TIMESTAMP(3),
    "reintentadoEn" TIMESTAMP(3),
    "reintentadoPor" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correos_enviados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "correos_enviados_empresaId_creadoEn_idx" ON "correos_enviados"("empresaId", "creadoEn");

-- CreateIndex
CREATE INDEX "correos_enviados_empresaId_estado_idx" ON "correos_enviados"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "correos_enviados_lote_idx" ON "correos_enviados"("lote");

-- AddForeignKey
ALTER TABLE "correos_enviados" ADD CONSTRAINT "correos_enviados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ítem de menú (el seed NO corre en el deploy). Acceso inicial = el que cada
-- perfil tiene en Auditoría.
INSERT INTO "items_menu" ("codigo", "nombre", "grupo", "seccion", "ruta", "esAccion", "tipo", "orden")
VALUES
  ('CONFIG_CORREOS_ENVIADOS', 'Correos Enviados', 'Configuración', 'Herramientas', '/dashboard/configuracion/correos-enviados', false, 'PANTALLA', 8060)
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
JOIN "items_menu" origen ON origen."id" = pa."itemMenuId" AND origen."codigo" = 'CONFIG_AUDITORIA'
JOIN "items_menu" destino ON destino."codigo" = 'CONFIG_CORREOS_ENVIADOS'
ON CONFLICT ("perfilId", "itemMenuId") DO NOTHING;

-- Auditoría se mueve a Configuración › Herramientas (decisión del usuario).
UPDATE "items_menu" SET "seccion" = 'Herramientas', "orden" = 8070 WHERE "codigo" = 'CONFIG_AUDITORIA';
