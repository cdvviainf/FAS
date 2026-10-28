-- Cobranza — Nota de Crédito de anulación (Ciclo 4, cobranza.md §0.j).
-- Primera entrega: NC de ANULACIÓN total de una factura ya timbrada (DTE 112 de
-- exportación que referencia la 110, o DTE 61 nacional que referencia la 33/34;
-- CodRef=1). Aplicación POLIMÓRFICA (CHECK XOR: exactamente una factura destino).
-- Al timbrar la NC, la factura pasa a estado SII ANULADA y estadoCobranza ANULADA
-- (valor nuevo del enum). Mismo motor DocumentoDte que las facturas.

-- CreateEnum
CREATE TYPE "EstadoNotaCredito" AS ENUM ('BORRADOR', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "MotivoNotaCredito" AS ENUM ('ANULA_DOCUMENTO', 'CORRIGE_MONTO', 'OTRO');

-- AlterEnum: factura anulada con NC sale de la cartera activa.
ALTER TYPE "EstadoCobranza" ADD VALUE 'ANULADA';

-- CreateTable
CREATE TABLE "notas_credito" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "facturaExportacionId" INTEGER,
    "facturaNacionalId" INTEGER,
    "tipoDte" INTEGER NOT NULL,
    "motivo" "MotivoNotaCredito" NOT NULL DEFAULT 'ANULA_DOCUMENTO',
    "clienteId" INTEGER NOT NULL,
    "monedaId" INTEGER NOT NULL,
    "montoTotal" DECIMAL(14,2) NOT NULL,
    "idioma" TEXT NOT NULL DEFAULT 'ES',
    "estado" "EstadoNotaCredito" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" TIMESTAMP(3),
    "observaciones" TEXT,
    "errorMensajeSii" TEXT,
    "folio" INTEGER,
    "trackIdSii" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emitidoPorId" TEXT,
    "emitidoEn" TIMESTAMP(3),
    "actualizadoEn" TIMESTAMP(3),
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "notas_credito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notas_credito_empresaId_idx" ON "notas_credito"("empresaId");
CREATE INDEX "notas_credito_facturaExportacionId_idx" ON "notas_credito"("facturaExportacionId");
CREATE INDEX "notas_credito_facturaNacionalId_idx" ON "notas_credito"("facturaNacionalId");
CREATE INDEX "notas_credito_clienteId_idx" ON "notas_credito"("clienteId");
CREATE UNIQUE INDEX "notas_credito_empresaId_id_key" ON "notas_credito"("empresaId", "id");

-- Unicidad de codigo por empresa, parcial (permite reuso tras soft delete).
CREATE UNIQUE INDEX "notas_credito_empresaId_codigo_key" ON "notas_credito"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;

-- AddForeignKey
ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_empresaId_facturaExportacionId_fkey" FOREIGN KEY ("empresaId", "facturaExportacionId") REFERENCES "facturas_exportacion"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_empresaId_facturaNacionalId_fkey" FOREIGN KEY ("empresaId", "facturaNacionalId") REFERENCES "facturas_nacional"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_empresaId_clienteId_fkey" FOREIGN KEY ("empresaId", "clienteId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK XOR: exactamente una factura destino (export O nacional).
ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_factura_xor"
  CHECK (("facturaExportacionId" IS NOT NULL)::int + ("facturaNacionalId" IS NOT NULL)::int = 1);

-- Provisionar el prefijo NC (modelo 'notaCredito') para las empresas existentes
-- (prod no corre seed). Idempotente.
INSERT INTO "prefijos_codigo" ("empresaId", "modelo", "prefijo", "digitos", "creadoPor")
SELECT e."id", 'notaCredito', 'NC', 4, 'migracion-cobranza-nc'
FROM "empresas" e
WHERE NOT EXISTS (
  SELECT 1 FROM "prefijos_codigo" p
  WHERE p."empresaId" = e."id" AND p."modelo" = 'notaCredito' AND p."eliminadoEn" IS NULL
);
