-- Feature "Carga de Recetas": el ItemMenu debe existir tras `prisma migrate
-- deploy` (el seed NO corre en el deploy — ver Dockerfile CMD). Sin esto, el
-- cargador queda rechazado por requireLevel incluso para admin.

-- 1) Alta idempotente del ítem (mismos datos que prisma/seed.ts).
INSERT INTO "items_menu" ("codigo", "nombre", "grupo", "seccion", "ruta", "esAccion", "tipo", "orden")
VALUES
  ('MATERIALES_CARGA_RECETAS', 'Carga de Recetas', 'Configuración', 'Materiales', '/dashboard/configuracion/carga-recetas', false, 'PANTALLA', 8240)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "grupo" = EXCLUDED."grupo",
  "seccion" = EXCLUDED."seccion",
  "ruta" = EXCLUDED."ruta",
  "esAccion" = EXCLUDED."esAccion",
  "tipo" = EXCLUDED."tipo",
  "orden" = EXCLUDED."orden";

-- 2) Acceso inicial: cada perfil hereda el nivel que ya tiene en Recetas
--    (MATERIALES_RECETAS), sin pisar un nivel ya asignado. ADMIN queda TOTAL.
INSERT INTO "perfil_accesos" ("perfilId", "itemMenuId", "nivel")
SELECT pa."perfilId", destino."id", pa."nivel"
FROM "perfil_accesos" pa
JOIN "items_menu" origen ON origen."id" = pa."itemMenuId" AND origen."codigo" = 'MATERIALES_RECETAS'
JOIN "items_menu" destino ON destino."codigo" = 'MATERIALES_CARGA_RECETAS'
ON CONFLICT ("perfilId", "itemMenuId") DO NOTHING;
