-- CM-009: el ItemMenu del mantenedor de Características de Madurez debe existir
-- tras `prisma migrate deploy` (el seed NO corre en el deploy — ver Dockerfile
-- CMD). Sin esto, el CRUD queda rechazado por requireLevel incluso para admin.

-- 1) Alta idempotente del ítem (mismos datos que prisma/seed.ts).
INSERT INTO "items_menu" ("codigo", "nombre", "grupo", "seccion", "ruta", "esAccion", "tipo", "orden")
VALUES
  ('CONFIG_CARACTERISTICAS_MADUREZ', 'Características de Madurez', 'Configuración', 'Calidad', '/dashboard/configuracion/caracteristicas-madurez', false, 'PANTALLA', 8425)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "grupo" = EXCLUDED."grupo",
  "seccion" = EXCLUDED."seccion",
  "ruta" = EXCLUDED."ruta",
  "esAccion" = EXCLUDED."esAccion",
  "tipo" = EXCLUDED."tipo",
  "orden" = EXCLUDED."orden";

-- 2) Acceso inicial: cada perfil hereda el nivel que ya tiene en el mantenedor
--    hermano de Calidad (CONFIG_DEFECTOS), sin pisar un nivel ya asignado.
--    El perfil ADMIN tiene TOTAL en los mantenedores, por lo que queda TOTAL.
INSERT INTO "perfil_accesos" ("perfilId", "itemMenuId", "nivel")
SELECT pa."perfilId", destino."id", pa."nivel"
FROM "perfil_accesos" pa
JOIN "items_menu" origen ON origen."id" = pa."itemMenuId" AND origen."codigo" = 'CONFIG_DEFECTOS'
JOIN "items_menu" destino ON destino."codigo" = 'CONFIG_CARACTERISTICAS_MADUREZ'
ON CONFLICT ("perfilId", "itemMenuId") DO NOTHING;
