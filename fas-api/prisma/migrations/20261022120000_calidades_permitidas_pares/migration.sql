-- "Calidades permitidas" = pares (NotaCalidad, NotaCondicion). Reemplaza en la
-- Solicitud de Inspección las dos listas independientes (que permitían el
-- producto cartesiano) por combinaciones específicas; y agrega la misma
-- definición al Cierre Comercial (NotaVenta) y al Instructivo de Embalaje.

-- ── Solicitud de Inspección ──────────────────────────────────────────────────
CREATE TABLE "solicitud_inspeccion_calidades_permitidas" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "notaCalidadId" INTEGER NOT NULL,
    "notaCondicionId" INTEGER NOT NULL,
    CONSTRAINT "solicitud_inspeccion_calidades_permitidas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "solicitud_inspeccion_calidades_permitidas_uniq" ON "solicitud_inspeccion_calidades_permitidas"("solicitudId", "notaCalidadId", "notaCondicionId");
CREATE INDEX "solicitud_inspeccion_calidades_permitidas_sol_idx" ON "solicitud_inspeccion_calidades_permitidas"("solicitudId");
ALTER TABLE "solicitud_inspeccion_calidades_permitidas" ADD CONSTRAINT "sicp_solicitud_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_calidades_permitidas" ADD CONSTRAINT "sicp_notaCalidad_fkey" FOREIGN KEY ("notaCalidadId") REFERENCES "notas_calidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_calidades_permitidas" ADD CONSTRAINT "sicp_notaCondicion_fkey" FOREIGN KEY ("notaCondicionId") REFERENCES "notas_condicion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migración de datos: cada Solicitud existente expande sus notas de calidad ×
-- notas de condición al producto cartesiano (mismo conjunto admitido que antes;
-- ya editable a pares). Solicitudes con solo una de las dos listas no generan
-- pares (el par requiere ambas).
INSERT INTO "solicitud_inspeccion_calidades_permitidas" ("solicitudId", "notaCalidadId", "notaCondicionId")
SELECT ca."solicitudId", ca."notaCalidadId", co."notaCondicionId"
FROM "solicitud_inspeccion_notas_calidad" ca
JOIN "solicitud_inspeccion_notas_condicion" co ON co."solicitudId" = ca."solicitudId";

DROP TABLE "solicitud_inspeccion_notas_calidad";
DROP TABLE "solicitud_inspeccion_notas_condicion";

-- ── Cierre Comercial (Nota de Venta) ─────────────────────────────────────────
CREATE TABLE "nota_venta_calidades_permitidas" (
    "id" SERIAL NOT NULL,
    "notaVentaId" INTEGER NOT NULL,
    "notaCalidadId" INTEGER NOT NULL,
    "notaCondicionId" INTEGER NOT NULL,
    CONSTRAINT "nota_venta_calidades_permitidas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "nota_venta_calidades_permitidas_uniq" ON "nota_venta_calidades_permitidas"("notaVentaId", "notaCalidadId", "notaCondicionId");
CREATE INDEX "nota_venta_calidades_permitidas_nv_idx" ON "nota_venta_calidades_permitidas"("notaVentaId");
ALTER TABLE "nota_venta_calidades_permitidas" ADD CONSTRAINT "nvcp_notaVenta_fkey" FOREIGN KEY ("notaVentaId") REFERENCES "notas_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nota_venta_calidades_permitidas" ADD CONSTRAINT "nvcp_notaCalidad_fkey" FOREIGN KEY ("notaCalidadId") REFERENCES "notas_calidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "nota_venta_calidades_permitidas" ADD CONSTRAINT "nvcp_notaCondicion_fkey" FOREIGN KEY ("notaCondicionId") REFERENCES "notas_condicion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Instructivo de Embalaje ──────────────────────────────────────────────────
CREATE TABLE "instructivo_embalaje_calidades_permitidas" (
    "id" SERIAL NOT NULL,
    "instructivoId" INTEGER NOT NULL,
    "notaCalidadId" INTEGER NOT NULL,
    "notaCondicionId" INTEGER NOT NULL,
    CONSTRAINT "instructivo_embalaje_calidades_permitidas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instructivo_embalaje_calidades_permitidas_uniq" ON "instructivo_embalaje_calidades_permitidas"("instructivoId", "notaCalidadId", "notaCondicionId");
CREATE INDEX "instr_embalaje_calidades_permitidas_idx" ON "instructivo_embalaje_calidades_permitidas"("instructivoId");
ALTER TABLE "instructivo_embalaje_calidades_permitidas" ADD CONSTRAINT "iecp_instructivo_fkey" FOREIGN KEY ("instructivoId") REFERENCES "instructivos_embalaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instructivo_embalaje_calidades_permitidas" ADD CONSTRAINT "iecp_notaCalidad_fkey" FOREIGN KEY ("notaCalidadId") REFERENCES "notas_calidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instructivo_embalaje_calidades_permitidas" ADD CONSTRAINT "iecp_notaCondicion_fkey" FOREIGN KEY ("notaCondicionId") REFERENCES "notas_condicion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
