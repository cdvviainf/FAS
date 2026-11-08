-- Monitor DTE (2026-11-07): veredicto del SII guardado en documentos_dte, igual
-- para todos los tipos (facturas, notas de crédito y guías), + ítem de menú.

-- 1) Columnas de estado SII.
CREATE TYPE "EstadoSiiDte" AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO');

ALTER TABLE "documentos_dte"
  ADD COLUMN "estadoSii" "EstadoSiiDte",
  ADD COLUMN "estadoSiiGlosa" TEXT,
  ADD COLUMN "estadoSiiConsultadoEn" TIMESTAMP(3);

CREATE INDEX "documentos_dte_empresaId_estado_generadoEn_idx" ON "documentos_dte"("empresaId", "estado", "generadoEn");

-- 2) Backfill de los documentos ya firmados (GENERADO). Facturas: desde su estado
--    actual (APROBADA → ACEPTADO, RECHAZADA → RECHAZADO con la glosa del SII).
--    Todo lo demás (ENVIADA_SII, ANULADA, NC, guías) queda PENDIENTE hasta la
--    primera consulta.
UPDATE "documentos_dte" d
SET "estadoSii" = CASE f."estado"
      WHEN 'APROBADA' THEN 'ACEPTADO'::"EstadoSiiDte"
      WHEN 'RECHAZADA' THEN 'RECHAZADO'::"EstadoSiiDte"
      ELSE 'PENDIENTE'::"EstadoSiiDte" END,
    "estadoSiiGlosa" = CASE WHEN f."estado" = 'RECHAZADA' THEN f."errorMensajeSii" ELSE NULL END
FROM "facturas_exportacion" f
WHERE d."estado" = 'GENERADO' AND d."origenTipo" = 'factura-exportacion' AND f."id" = d."origenId";

UPDATE "documentos_dte" d
SET "estadoSii" = CASE f."estado"
      WHEN 'APROBADA' THEN 'ACEPTADO'::"EstadoSiiDte"
      WHEN 'RECHAZADA' THEN 'RECHAZADO'::"EstadoSiiDte"
      ELSE 'PENDIENTE'::"EstadoSiiDte" END,
    "estadoSiiGlosa" = CASE WHEN f."estado" = 'RECHAZADA' THEN f."errorMensajeSii" ELSE NULL END
FROM "facturas_nacional" f
WHERE d."estado" = 'GENERADO' AND d."origenTipo" = 'factura-nacional' AND f."id" = d."origenId";

UPDATE "documentos_dte" SET "estadoSii" = 'PENDIENTE'
WHERE "estado" = 'GENERADO' AND "estadoSii" IS NULL;

-- 3) Ítem de menú (el seed NO corre en el deploy). Acceso inicial: cada perfil
--    hereda el nivel que ya tiene en Facturación Nacional, sin pisar uno asignado.
INSERT INTO "items_menu" ("codigo", "nombre", "grupo", "seccion", "ruta", "esAccion", "tipo", "orden")
VALUES
  ('FACT_MONITOR_DTE', 'Monitor DTE', 'Gestión Comercial', 'Facturación y Cobranza', '/dashboard/facturacion/monitor-dte', false, 'PANTALLA', 2345)
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
JOIN "items_menu" origen ON origen."id" = pa."itemMenuId" AND origen."codigo" = 'FACT_NACIONAL'
JOIN "items_menu" destino ON destino."codigo" = 'FACT_MONITOR_DTE'
ON CONFLICT ("perfilId", "itemMenuId") DO NOTHING;
