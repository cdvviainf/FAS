-- Entidad: campos CSP y TAXID (2026-10-09).
-- CSP es obligatorio cuando la entidad es PLANTA; TAXID cuando es
-- CLIENTE_EXTRANJERO. La obligatoriedad es condicional por tipo y se valida en
-- la aplicación (no con NOT NULL), igual que giro/identificador.
ALTER TABLE "entidades" ADD COLUMN "csp" TEXT;
ALTER TABLE "entidades" ADD COLUMN "taxId" TEXT;
