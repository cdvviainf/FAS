-- Fuentes de tipo de cambio con prioridad + respaldo local + tipo de cambio en
-- la Proforma de Materiales (2026-11-09).

-- 1) Prioridad de consulta en Integraciones (fuentes TC_*).
ALTER TABLE "integraciones" ADD COLUMN "prioridad" INTEGER;

-- 2) Tipo de cambio en la Proforma de Materiales (CLP por 1 unidad de la moneda).
ALTER TABLE "proformas_material" ADD COLUMN "tipoCambio" DECIMAL(14,4);

-- 3) Respaldo local de tipos de cambio (global, no tenant).
CREATE TABLE "tipos_cambio_historico" (
    "id" SERIAL NOT NULL,
    "monedaCodigo" TEXT NOT NULL,
    "fechaConsulta" DATE NOT NULL,
    "fechaParidad" DATE NOT NULL,
    "valor" DECIMAL(14,4) NOT NULL,
    "fuente" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tipos_cambio_historico_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tipos_cambio_historico_monedaCodigo_fechaConsulta_key" ON "tipos_cambio_historico"("monedaCodigo", "fechaConsulta");
CREATE INDEX "tipos_cambio_historico_monedaCodigo_fechaParidad_idx" ON "tipos_cambio_historico"("monedaCodigo", "fechaParidad");

-- 4) Fuente por defecto: mindicador.cl (la que se usaba fija en el código) como
--    Integración TC_MINDICADOR activa, prioridad 3, en cada empresa. CMF y Banco
--    Central se crean desde Configuración → Integraciones con sus credenciales.
INSERT INTO "integraciones" ("empresaId", "codigo", "descripcion", "url", "activo", "prioridad", "creadoEn", "creadoPor")
SELECT e."id", 'TC_MINDICADOR', 'Tipo de cambio — mindicador.cl (dólar/euro observado)', NULL, true, 3, CURRENT_TIMESTAMP, 'sistema'
FROM "empresas" e
WHERE e."eliminadoEn" IS NULL
-- El índice único (empresaId, codigo) incluye filas eliminadas: si ya existe
-- (activa o no), se respeta tal cual.
ON CONFLICT ("empresaId", "codigo") DO NOTHING;
