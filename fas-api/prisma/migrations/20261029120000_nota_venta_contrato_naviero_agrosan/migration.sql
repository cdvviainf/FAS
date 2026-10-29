-- Cierre Comercial: flag "Contrato naviero Agrosan" (Sí/No).
ALTER TABLE "notas_venta" ADD COLUMN "contratoNavieroAgrosan" BOOLEAN NOT NULL DEFAULT false;
