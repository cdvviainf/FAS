-- Eliminar la pantalla "Configuración General" (2026-11-06): solo contenía el
-- SMTP, que es por empresa y se administra en Empresas › SMTP (permiso
-- CONFIG_EMPRESAS). Se borran sus accesos de perfil y el ítem de menú.
DELETE FROM "perfil_accesos"
WHERE "itemMenuId" IN (SELECT "id" FROM "items_menu" WHERE "codigo" = 'CONFIG_GENERAL');

DELETE FROM "items_menu" WHERE "codigo" = 'CONFIG_GENERAL';
