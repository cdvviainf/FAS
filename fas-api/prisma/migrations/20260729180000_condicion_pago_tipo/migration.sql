-- CreateEnum
CREATE TYPE "TipoCondicionPago" AS ENUM ('COMPRA', 'VENTA');

-- AlterTable
-- Se agrega nullable primero para no romper filas existentes en ambientes
-- con datos reales (ej. condiciones de pago creadas antes de este cambio).
ALTER TABLE "condiciones_pago" ADD COLUMN "tipo" "TipoCondicionPago";

-- Backfill: las condiciones de pago creadas antes de este cambio no tenían
-- tipo — quedan como COMPRA por defecto (valor seguro, revisar manualmente
-- si corresponde a Venta; el campo es inmutable desde el mantenedor una vez
-- creado, así que si el valor no es el correcto conviene eliminar y volver
-- a crear la condición con el tipo correcto).
UPDATE "condiciones_pago" SET "tipo" = 'COMPRA' WHERE "tipo" IS NULL;

-- Ahora sí, obligatorio
ALTER TABLE "condiciones_pago" ALTER COLUMN "tipo" SET NOT NULL;
