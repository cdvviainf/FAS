-- Auditoría (trazabilidad de acciones de usuario) — módulo portable (2026-10-15).

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('LOGIN', 'LOGOUT', 'LOGIN_FALLIDO', 'ACCESO_MENU', 'CREAR', 'EDITAR', 'ELIMINAR');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER,
    "usuarioId" TEXT,
    "usuarioEmail" TEXT,
    "accion" "AccionAuditoria" NOT NULL,
    "entidad" TEXT,
    "entidadId" TEXT,
    "ruta" TEXT,
    "itemMenuCodigo" TEXT,
    "datosAntes" JSONB,
    "datosDespues" JSONB,
    "resumen" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_empresaId_creadoEn_idx" ON "audit_logs"("empresaId", "creadoEn");
CREATE INDEX "audit_logs_usuarioId_creadoEn_idx" ON "audit_logs"("usuarioId", "creadoEn");
CREATE INDEX "audit_logs_accion_creadoEn_idx" ON "audit_logs"("accion", "creadoEn");
CREATE INDEX "audit_logs_entidad_entidadId_idx" ON "audit_logs"("entidad", "entidadId");

-- ItemMenu + acceso ADMIN del módulo de auditoría (A-QA-003): el despliegue de
-- producción corre `migrate deploy` (no `seed`), así que el permiso debe
-- crearse acá de forma idempotente, siguiendo el patrón de 20261007120000.
INSERT INTO "items_menu" ("codigo", "nombre", "grupo", "seccion", "ruta", "esAccion", "tipo", "orden")
VALUES ('CONFIG_AUDITORIA', 'Auditoría', 'Configuración', 'Sistema', '/dashboard/configuracion/auditoria', false, 'REPORTE', 8940)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "grupo" = EXCLUDED."grupo",
  "seccion" = EXCLUDED."seccion",
  "ruta" = EXCLUDED."ruta",
  "esAccion" = EXCLUDED."esAccion",
  "tipo" = EXCLUDED."tipo",
  "orden" = EXCLUDED."orden";

-- Perfil ADMIN: acceso TOTAL al nuevo ítem (idempotente).
INSERT INTO "perfil_accesos" ("perfilId", "itemMenuId", "nivel")
SELECT p."id", i."id", 'TOTAL'
FROM "perfiles" p
JOIN "items_menu" i ON i."codigo" = 'CONFIG_AUDITORIA'
WHERE p."codigo" = 'ADMIN' AND p."eliminadoEn" IS NULL
ON CONFLICT ("perfilId", "itemMenuId") DO NOTHING;
