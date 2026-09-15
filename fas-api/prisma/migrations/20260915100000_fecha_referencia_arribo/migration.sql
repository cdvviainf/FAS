-- Nueva fecha de referencia de pago: Fecha de Arribo.
ALTER TYPE "FechaReferenciaPago" ADD VALUE IF NOT EXISTS 'ARRIBO';
