-- Al crear la Solicitud de Inspección los asignados son NOTIFICADOS; los
-- asistentes (ACUDIR) se registran en "Editar inspección" (2026-11-10). El
-- formulario de creación asignaba ACUDIR por defecto: en solicitudes aún
-- abiertas (PENDIENTE/NOTIFICADA) se corrigen a NOTIFICAR (decisión del
-- usuario). Las cerradas no se tocan.
UPDATE "solicitud_inspeccion_asignados" a
SET "funcion" = 'NOTIFICAR'
FROM "solicitudes_inspeccion" s
WHERE a."solicitudId" = s."id"
  AND a."funcion" = 'ACUDIR'
  AND s."estado" IN ('PENDIENTE', 'NOTIFICADA')
  AND s."eliminadoEn" IS NULL;
