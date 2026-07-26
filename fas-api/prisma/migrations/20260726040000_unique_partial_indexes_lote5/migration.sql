-- Unique partial indexes (G2/DoD-02) for mantenedores added without them:
-- Calificacion (QAS-SI-017), FormaPago and CondicionPago (same gap, same session).
CREATE UNIQUE INDEX IF NOT EXISTS ux_calificaciones_codigo ON calificaciones (codigo) WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_formas_pago_codigo ON formas_pago (codigo) WHERE "eliminadoEn" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_condiciones_pago_codigo ON condiciones_pago (codigo) WHERE "eliminadoEn" IS NULL;
