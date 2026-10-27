-- Condiciones comerciales de compra a GRANEL en la OC (2026-10-27).
CREATE TYPE "ModalidadEntregaGranel" AS ENUM ('PUESTA_EN_CAMPO', 'ENTREGADA_EN_PLANTA');
CREATE TYPE "ResponsableProductorExportadora" AS ENUM ('PRODUCTOR', 'EXPORTADORA');

ALTER TABLE "ordenes_compra"
  ADD COLUMN "porcentajeMinExportacion" DECIMAL(5,2),
  ADD COLUMN "modalidadEntregaGranel" "ModalidadEntregaGranel",
  ADD COLUMN "envasesProporcionadosPor" "ResponsableProductorExportadora",
  ADD COLUMN "encargadoDescartePor" "ResponsableProductorExportadora";
