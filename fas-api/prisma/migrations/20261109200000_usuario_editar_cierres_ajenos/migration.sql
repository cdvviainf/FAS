-- Cierre Comercial (2026-11-09): mientras está abierto, solo su creador lo
-- edita. Permiso a nivel de USUARIO (no de perfil) para editar Cierres de
-- otros usuarios. Por defecto nadie lo tiene.
ALTER TABLE "usuarios" ADD COLUMN "puedeEditarCierresAjenos" BOOLEAN NOT NULL DEFAULT false;
