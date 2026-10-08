-- 2026-10-07 · Reorganización de permisos: jerarquía (grupo), tipo de ítem y un
-- permiso por mantenedor. TODO se aplica aquí (migración idempotente) porque
-- producción solo corre `prisma migrate deploy` (no el seed). El seed replica lo
-- mismo para BD de desarrollo fresca (sus bloques de backfill quedan no-op tras
-- esta migración: CONFIG_MANTENEDORES ya no existe y los ítems nuevos ya están).

-- 1) Esquema: enum de tipo + columnas grupo/tipo.
CREATE TYPE "ItemMenuTipo" AS ENUM ('PANTALLA', 'ACCION', 'REPORTE');
ALTER TABLE "items_menu" ADD COLUMN "grupo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "items_menu" ADD COLUMN "tipo" "ItemMenuTipo" NOT NULL DEFAULT 'PANTALLA';

-- 2) Catálogo completo (crea los ítems nuevos, actualiza grupo/sección/ruta/
--    tipo/orden/esAccion de los existentes). `activo` usa su default (true).
INSERT INTO "items_menu" ("codigo", "nombre", "grupo", "seccion", "ruta", "esAccion", "tipo", "orden") VALUES
  ('DASHBOARD', 'Dashboard', 'Inicio', 'Inicio', '/dashboard', false, 'PANTALLA', 1000),
  ('COMPRAS_SOLICITUDES', 'Solicitud de Inspección', 'Gestión Comercial', 'Compras', '/dashboard/compras/solicitudes', false, 'PANTALLA', 2110),
  ('COMPRAS_OC', 'Órdenes de Compra', 'Gestión Comercial', 'Compras', '/dashboard/compras/ordenes', false, 'PANTALLA', 2120),
  ('OC_APROBACION', 'Aprobación de OC', 'Gestión Comercial', 'Compras', NULL, true, 'ACCION', 2130),
  ('COMPRAS_INSTRUCTIVO', 'Instructivo de Embalaje', 'Gestión Comercial', 'Compras', '/dashboard/compras/instructivo-embalaje', false, 'PANTALLA', 2140),
  ('COMPRAS_RECEPCION', 'Recepción de Stock', 'Gestión Comercial', 'Compras', '/dashboard/compras/recepciones', false, 'PANTALLA', 2150),
  ('VENTAS_NV', 'Cierre Comercial', 'Gestión Comercial', 'Ventas', '/dashboard/ventas/cierre', false, 'PANTALLA', 2210),
  ('VENTAS_REABRIR_CIERRE', 'Reabrir Cierre Comercial', 'Gestión Comercial', 'Ventas', NULL, true, 'ACCION', 2220),
  ('VENTAS_EMBARQUES', 'Embarques', 'Gestión Comercial', 'Ventas', '/dashboard/ventas/embarques', false, 'PANTALLA', 2230),
  ('VENTAS_RECLAMOS', 'Reclamos', 'Gestión Comercial', 'Ventas', '/dashboard/ventas/reclamos', false, 'PANTALLA', 2240),
  ('RECLAMO_VALORIZACION', 'Valorización Reclamo', 'Gestión Comercial', 'Ventas', NULL, true, 'ACCION', 2250),
  ('RECLAMO_PROVISION', 'Provisión de Reclamo', 'Gestión Comercial', 'Ventas', NULL, true, 'ACCION', 2260),
  ('FACT_EXPORTACION', 'Facturación Exportación', 'Gestión Comercial', 'Facturación y Cobranza', '/dashboard/facturacion/exportacion', false, 'PANTALLA', 2310),
  ('FACT_NACIONAL', 'Facturación Nacional', 'Gestión Comercial', 'Facturación y Cobranza', '/dashboard/facturacion/nacional', false, 'PANTALLA', 2320),
  ('VENTAS_COBRANZA', 'Cobranza / CRM', 'Gestión Comercial', 'Facturación y Cobranza', '/dashboard/facturacion/cobranza', false, 'PANTALLA', 2330),
  ('OPER_MATERIALES', 'Movimientos de Materiales', 'Operaciones', 'Materiales', '/dashboard/operaciones/movimientos', false, 'PANTALLA', 3110),
  ('MATERIALES_OC', 'Orden de Compra de Materiales', 'Operaciones', 'Materiales', '/dashboard/operaciones/materiales/ordenes-compra', false, 'PANTALLA', 3120),
  ('MATERIALES_PROFORMA', 'Proforma de Venta de Materiales', 'Operaciones', 'Materiales', '/dashboard/operaciones/materiales/proformas', false, 'PANTALLA', 3130),
  ('PROD_FICHA', 'Productores', 'Gestión Productores', 'Productores', '/dashboard/configuracion/productores', false, 'PANTALLA', 4110),
  ('PROD_CONTRATO', 'Contrato', 'Gestión Productores', 'Productores', '/dashboard/productores/contrato', false, 'PANTALLA', 4120),
  ('PROD_CTA_CTE', 'Cuenta Corriente', 'Gestión Productores', 'Productores', '/dashboard/productores/cuenta-corriente', false, 'PANTALLA', 4130),
  ('PROD_CONCEPTOS_LIQ', 'Conceptos de Liquidación', 'Gestión Productores', 'Productores', '/dashboard/configuracion/conceptos-liquidacion', false, 'PANTALLA', 4140),
  ('LIQ_CLIENTES', 'Liquidación Clientes', 'Gestión Productores', 'Liquidaciones', '/dashboard/liquidaciones/clientes', false, 'PANTALLA', 4210),
  ('LIQ_COSTOS', 'Matriz de Costos', 'Gestión Productores', 'Liquidaciones', '/dashboard/liquidaciones/costos', false, 'PANTALLA', 4220),
  ('LIQ_PRECIOS', 'Determinación de Precios', 'Gestión Productores', 'Liquidaciones', '/dashboard/liquidaciones/precios', false, 'PANTALLA', 4230),
  ('LIQ_PRODUCTOR', 'Liquidación Productor', 'Gestión Productores', 'Liquidaciones', '/dashboard/liquidaciones/productor', false, 'PANTALLA', 4240),
  ('CAL_SOLICITUDES', 'Solicitudes de Inspección', 'Calidad', 'Calidad', '/dashboard/calidad', false, 'PANTALLA', 5110),
  ('CAL_CONTROL', 'Control de Calidad', 'Calidad', 'Calidad', '/dashboard/calidad/control', false, 'PANTALLA', 5120),
  ('CAL_LOTES', 'Validación de Lotes', 'Calidad', 'Calidad', '/dashboard/calidad/lotes', false, 'PANTALLA', 5130),
  ('CAL_RECLAMOS', 'Reclamos', 'Calidad', 'Calidad', '/dashboard/calidad/reclamos', false, 'PANTALLA', 5140),
  ('RECLAMO_CIERRE', 'Veredicto Final / Cierre Reclamo', 'Calidad', 'Calidad', NULL, true, 'ACCION', 5150),
  ('OPERACIONES_GESTION_PALLETS', 'Calificación de Pallets', 'Calidad', 'Calidad', '/dashboard/operaciones/pallets', false, 'PANTALLA', 5160),
  ('FIN_COSTOS', 'Gestión de Costos', 'Finanzas', 'Finanzas', '/dashboard/finanzas/costos', false, 'PANTALLA', 6110),
  ('FIN_PAGOS', 'Gestión de Pagos', 'Finanzas', 'Finanzas', '/dashboard/finanzas/pagos', false, 'PANTALLA', 6120),
  ('REPORTES_STOCK_FRUTA', 'Stock de Fruta', 'Reportes', 'Reportes', '/dashboard/reportes/stock-fruta', false, 'REPORTE', 7110),
  ('OPER_STOCK_EDICION', 'Edición de Stock', 'Reportes', 'Reportes', NULL, true, 'ACCION', 7120),
  ('REPORTES_KARDEX_MATERIALES', 'Kardex de Materiales', 'Reportes', 'Reportes', '/dashboard/reportes/kardex-materiales', false, 'REPORTE', 7130),
  ('REPORTES_STOCK_RECETA', 'Stock por Receta', 'Reportes', 'Reportes', '/dashboard/reportes/stock-materiales', false, 'REPORTE', 7140),
  ('REPORTES_STOCK_MATERIALES', 'Stock de Materiales', 'Reportes', 'Reportes', '/dashboard/reportes/saldos-materiales', false, 'REPORTE', 7150),
  ('REPORTES_GESTION_RIESGO', 'Gestión de Riesgo', 'Reportes', 'Reportes', '/dashboard/reportes/gestion-riesgo', false, 'REPORTE', 7160),
  ('CONFIG_CARGA_MASIVA', 'Carga Masiva de Maestros', 'Configuración', 'Herramientas', '/dashboard/configuracion/carga-masiva', false, 'PANTALLA', 8050),
  ('CONFIG_ENTIDADES', 'Entidades', 'Configuración', 'Gestión Comercial', '/dashboard/configuracion/entidades', false, 'PANTALLA', 8110),
  ('CONFIG_GRUPOS_MERCADO', 'Grupos de Mercado', 'Configuración', 'Gestión Comercial', '/dashboard/configuracion/grupos-mercado', false, 'PANTALLA', 8120),
  ('CONFIG_MERCADOS', 'Mercados', 'Configuración', 'Gestión Comercial', '/dashboard/configuracion/mercados', false, 'PANTALLA', 8130),
  ('CONFIG_TIPOS_EMBARQUE', 'Tipos de Embarque', 'Configuración', 'Gestión Comercial', '/dashboard/configuracion/tipos-embarque', false, 'PANTALLA', 8140),
  ('CONFIG_PUERTOS', 'Puertos', 'Configuración', 'Gestión Comercial', '/dashboard/configuracion/puertos', false, 'PANTALLA', 8150),
  ('CONFIG_FORMAS_PAGO', 'Formas de Pago', 'Configuración', 'Gestión Comercial', '/dashboard/configuracion/formas-pago', false, 'PANTALLA', 8160),
  ('CONFIG_CONDICIONES_PAGO', 'Condiciones de Pago', 'Configuración', 'Gestión Comercial', '/dashboard/configuracion/condiciones-pago', false, 'PANTALLA', 8170),
  ('CONFIG_CLAUSULAS_VENTA', 'Cláusulas de Venta (Incoterm)', 'Configuración', 'Gestión Comercial', '/dashboard/configuracion/clausulas-venta', false, 'PANTALLA', 8180),
  ('MATERIALES_ARTICULOS', 'Artículos', 'Configuración', 'Materiales', '/dashboard/configuracion/articulos', false, 'PANTALLA', 8210),
  ('MATERIALES_RECETAS', 'Recetas', 'Configuración', 'Materiales', '/dashboard/configuracion/recetas', false, 'PANTALLA', 8220),
  ('CONFIG_CAJAS_POR_PALLET', 'Cajas por Pallet', 'Configuración', 'Materiales', '/dashboard/configuracion/cajas-por-pallet', false, 'PANTALLA', 8230),
  ('CONFIG_TIPOS_MOVIMIENTO', 'Tipos de Movimiento', 'Configuración', 'Operaciones', '/dashboard/configuracion/tipos-movimiento', false, 'PANTALLA', 8250),
  ('CONFIG_CONCEPTOS_CTA_CTE', 'Conceptos Cta. Cte.', 'Configuración', 'Gestión Productores', '/dashboard/configuracion/conceptos-cta-cte', false, 'PANTALLA', 8310),
  ('CONFIG_GRUPOS_DEFECTO', 'Grupos de Defecto', 'Configuración', 'Calidad', '/dashboard/configuracion/grupos-defecto', false, 'PANTALLA', 8410),
  ('CONFIG_DEFECTOS', 'Defectos', 'Configuración', 'Calidad', '/dashboard/configuracion/defectos', false, 'PANTALLA', 8420),
  ('CONFIG_NOTAS_CALIDAD', 'Notas de Calidad', 'Configuración', 'Calidad', '/dashboard/configuracion/notas-calidad', false, 'PANTALLA', 8430),
  ('CONFIG_NOTAS_CONDICION', 'Notas de Condición', 'Configuración', 'Calidad', '/dashboard/configuracion/notas-condicion', false, 'PANTALLA', 8440),
  ('CONFIG_TIPOS_RECLAMO', 'Tipos de Reclamo', 'Configuración', 'Calidad', '/dashboard/configuracion/tipos-reclamo', false, 'PANTALLA', 8450),
  ('CONFIG_ZONAS', 'Zonas', 'Configuración', 'Geográfico', '/dashboard/configuracion/zonas', false, 'PANTALLA', 8510),
  ('CONFIG_PAISES', 'Países', 'Configuración', 'Geográfico', '/dashboard/configuracion/paises', false, 'PANTALLA', 8520),
  ('CONFIG_REGIONES', 'Regiones', 'Configuración', 'Geográfico', '/dashboard/configuracion/regiones', false, 'PANTALLA', 8530),
  ('CONFIG_PROVINCIAS', 'Provincias', 'Configuración', 'Geográfico', '/dashboard/configuracion/provincias', false, 'PANTALLA', 8540),
  ('CONFIG_COMUNAS', 'Comunas', 'Configuración', 'Geográfico', '/dashboard/configuracion/comunas', false, 'PANTALLA', 8550),
  ('CONFIG_TIPOS_PALLET', 'Tipos de Pallet', 'Configuración', 'Operación', '/dashboard/configuracion/tipos-pallet', false, 'PANTALLA', 8610),
  ('CONFIG_ETIQUETAS', 'Etiquetas', 'Configuración', 'Operación', '/dashboard/configuracion/etiquetas', false, 'PANTALLA', 8620),
  ('CONFIG_ALTURAS', 'Alturas', 'Configuración', 'Operación', '/dashboard/configuracion/alturas', false, 'PANTALLA', 8630),
  ('CONFIG_TIPOS_PRODUCCION', 'Tipos de Producción', 'Configuración', 'Operación', '/dashboard/configuracion/tipos-produccion', false, 'PANTALLA', 8640),
  ('CONFIG_ESPECIES', 'Especies', 'Configuración', 'Fruta', '/dashboard/configuracion/especies', false, 'PANTALLA', 8710),
  ('CONFIG_GRUPOS_VARIEDAD', 'Grupos de Variedad', 'Configuración', 'Fruta', '/dashboard/configuracion/grupos-variedad', false, 'PANTALLA', 8720),
  ('CONFIG_VARIEDADES', 'Variedades', 'Configuración', 'Fruta', '/dashboard/configuracion/variedades', false, 'PANTALLA', 8730),
  ('CONFIG_CATEGORIAS', 'Categorías', 'Configuración', 'Fruta', '/dashboard/configuracion/categorias', false, 'PANTALLA', 8740),
  ('CONFIG_CALIBRES', 'Calibres', 'Configuración', 'Fruta', '/dashboard/configuracion/calibres', false, 'PANTALLA', 8750),
  ('CONFIG_EMPRESAS', 'Empresas', 'Configuración', 'Sistema', '/dashboard/configuracion/empresas', false, 'PANTALLA', 8810),
  ('CONFIG_USUARIOS', 'Usuarios', 'Configuración', 'Sistema', '/dashboard/configuracion/usuarios', false, 'PANTALLA', 8820),
  ('CONFIG_PERFILES', 'Perfiles', 'Configuración', 'Sistema', '/dashboard/configuracion/perfiles', false, 'PANTALLA', 8830),
  ('CONFIG_BODEGAS', 'Bodegas', 'Configuración', 'Sistema', '/dashboard/configuracion/bodegas', false, 'PANTALLA', 8840),
  ('CONFIG_UNIDADES_MEDIDA', 'Unidades de Medida', 'Configuración', 'Sistema', '/dashboard/configuracion/unidades-medida', false, 'PANTALLA', 8850),
  ('CONFIG_TEMPORADAS', 'Temporadas', 'Configuración', 'Sistema', '/dashboard/configuracion/temporadas', false, 'PANTALLA', 8860),
  ('CONFIG_MONEDAS', 'Monedas', 'Configuración', 'Sistema', '/dashboard/configuracion/monedas', false, 'PANTALLA', 8870),
  ('CONFIG_TIPOS_PARAMETRO', 'Tipos de Parámetro', 'Configuración', 'Sistema', '/dashboard/configuracion/tipos-parametro', false, 'PANTALLA', 8880),
  ('CONFIG_PARAMETROS', 'Parámetros', 'Configuración', 'Sistema', '/dashboard/configuracion/parametros', false, 'PANTALLA', 8890),
  ('CONFIG_PREFIJOS_CODIGO', 'Prefijos de Código', 'Configuración', 'Sistema', '/dashboard/configuracion/prefijos-codigo', false, 'PANTALLA', 8900),
  ('CONFIG_TEMPLATES_CARGA', 'Templates de Carga', 'Configuración', 'Sistema', '/dashboard/configuracion/templates-carga', false, 'PANTALLA', 8910),
  ('CONFIG_INTEGRACIONES', 'Integraciones', 'Configuración', 'Sistema', '/dashboard/configuracion/integraciones', false, 'PANTALLA', 8920),
  ('CONFIG_GENERAL', 'Configuración General', 'Configuración', 'Sistema', '/dashboard/configuracion/general', false, 'PANTALLA', 8930)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "grupo" = EXCLUDED."grupo",
  "seccion" = EXCLUDED."seccion",
  "ruta" = EXCLUDED."ruta",
  "esAccion" = EXCLUDED."esAccion",
  "tipo" = EXCLUDED."tipo",
  "orden" = EXCLUDED."orden";

-- 3) Backfill de accesos: cada perfil conserva en los ítems nuevos el mismo
--    nivel que tenía en el permiso genérico (sin pisar un nivel ya asignado).
-- 3a) CONFIG_MANTENEDORES → 35 catálogos propios.
INSERT INTO "perfil_accesos" ("perfilId", "itemMenuId", "nivel")
SELECT pa."perfilId", destino."id", pa."nivel"
FROM "perfil_accesos" pa
JOIN "items_menu" gen ON gen."id" = pa."itemMenuId" AND gen."codigo" = 'CONFIG_MANTENEDORES'
JOIN "items_menu" destino ON destino."codigo" IN (
  'CONFIG_PAISES','CONFIG_ZONAS','CONFIG_GRUPOS_MERCADO','CONFIG_TIPOS_EMBARQUE','CONFIG_FORMAS_PAGO',
  'CONFIG_UNIDADES_MEDIDA','CONFIG_TIPOS_PALLET','CONFIG_ETIQUETAS','CONFIG_ALTURAS','CONFIG_TIPOS_PRODUCCION',
  'CONFIG_TIPOS_PARAMETRO','CONFIG_GRUPOS_DEFECTO','CONFIG_REGIONES','CONFIG_ESPECIES','CONFIG_PROVINCIAS',
  'CONFIG_COMUNAS','CONFIG_GRUPOS_VARIEDAD','CONFIG_VARIEDADES','CONFIG_DEFECTOS','CONFIG_CATEGORIAS',
  'CONFIG_CALIBRES','CONFIG_PARAMETROS','CONFIG_CLAUSULAS_VENTA','CONFIG_TIPOS_RECLAMO','CONFIG_MERCADOS',
  'CONFIG_PUERTOS','CONFIG_MONEDAS','CONFIG_CONCEPTOS_CTA_CTE','CONFIG_TEMPORADAS','CONFIG_BODEGAS',
  'CONFIG_CONDICIONES_PAGO','CONFIG_NOTAS_CALIDAD','CONFIG_NOTAS_CONDICION','CONFIG_TEMPLATES_CARGA','CONFIG_PREFIJOS_CODIGO'
)
ON CONFLICT ("perfilId", "itemMenuId") DO NOTHING;

-- 3b) OPER_MATERIALES → Artículos, Recetas, Tipos de Movimiento (OPER_MATERIALES
--     se conserva para Movimientos de Materiales).
INSERT INTO "perfil_accesos" ("perfilId", "itemMenuId", "nivel")
SELECT pa."perfilId", destino."id", pa."nivel"
FROM "perfil_accesos" pa
JOIN "items_menu" gen ON gen."id" = pa."itemMenuId" AND gen."codigo" = 'OPER_MATERIALES'
JOIN "items_menu" destino ON destino."codigo" IN ('MATERIALES_ARTICULOS', 'MATERIALES_RECETAS', 'CONFIG_TIPOS_MOVIMIENTO')
ON CONFLICT ("perfilId", "itemMenuId") DO NOTHING;

-- 4) Perfil ADMIN: garantizar acceso TOTAL a cualquier ítem que le falte
--    (defensivo; no pisa niveles ya asignados).
INSERT INTO "perfil_accesos" ("perfilId", "itemMenuId", "nivel")
SELECT p."id", im."id", 'TOTAL'::"NivelAcceso"
FROM "perfiles" p
CROSS JOIN "items_menu" im
WHERE p."codigo" = 'ADMIN' AND p."eliminadoEn" IS NULL
ON CONFLICT ("perfilId", "itemMenuId") DO NOTHING;

-- 5) Eliminar el permiso genérico ya desglosado.
DELETE FROM "perfil_accesos" WHERE "itemMenuId" IN (SELECT "id" FROM "items_menu" WHERE "codigo" = 'CONFIG_MANTENEDORES');
DELETE FROM "items_menu" WHERE "codigo" = 'CONFIG_MANTENEDORES';
