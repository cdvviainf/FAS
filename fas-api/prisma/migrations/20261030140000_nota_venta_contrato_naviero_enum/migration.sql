-- Contrato naviero del Cierre Comercial pasa de booleano (Agrosan Sí/No) a enum
-- AGROSAN_AGL / CLIENTE (por defecto AGROSAN_AGL). Solo informativo.
CREATE TYPE "ContratoNaviero" AS ENUM ('AGROSAN_AGL', 'CLIENTE');
ALTER TABLE "notas_venta" ADD COLUMN "contratoNaviero" "ContratoNaviero" NOT NULL DEFAULT 'AGROSAN_AGL';
ALTER TABLE "notas_venta" DROP COLUMN "contratoNavieroAgrosan";
