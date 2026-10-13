-- Solicitud de Inspección (2026-10-13): la fecha/hora de la visita se fija al
-- editar la visita o en el cierre, no al crear. Defectos capturados en el
-- cierre (grupo + defecto + valor; entero o % según Defecto.tipoMedida).

-- Unidad de medida del valor del Defecto.
CREATE TYPE "TipoMedidaDefecto" AS ENUM ('UNIDADES', 'PORCENTAJE');
ALTER TABLE "defectos" ADD COLUMN "tipoMedida" "TipoMedidaDefecto" NOT NULL DEFAULT 'UNIDADES';

-- La fecha/hora de la visita pasa a opcional (ya no se exige al crear).
ALTER TABLE "solicitudes_inspeccion" ALTER COLUMN "fechaHora" DROP NOT NULL;

-- Líneas de defecto del cierre (tabla hija de la solicitud, sin empresaId).
CREATE TABLE "solicitud_inspeccion_defectos" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "grupoDefectoId" INTEGER NOT NULL,
    "defectoId" INTEGER NOT NULL,
    "valor" DECIMAL(7,2) NOT NULL,

    CONSTRAINT "solicitud_inspeccion_defectos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "solicitud_inspeccion_defectos_solicitudId_idx" ON "solicitud_inspeccion_defectos"("solicitudId");
CREATE INDEX "solicitud_inspeccion_defectos_grupoDefectoId_idx" ON "solicitud_inspeccion_defectos"("grupoDefectoId");
CREATE INDEX "solicitud_inspeccion_defectos_defectoId_idx" ON "solicitud_inspeccion_defectos"("defectoId");

ALTER TABLE "solicitud_inspeccion_defectos" ADD CONSTRAINT "solicitud_inspeccion_defectos_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_defectos" ADD CONSTRAINT "solicitud_inspeccion_defectos_grupoDefectoId_fkey" FOREIGN KEY ("grupoDefectoId") REFERENCES "grupos_defecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_defectos" ADD CONSTRAINT "solicitud_inspeccion_defectos_defectoId_fkey" FOREIGN KEY ("defectoId") REFERENCES "defectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
