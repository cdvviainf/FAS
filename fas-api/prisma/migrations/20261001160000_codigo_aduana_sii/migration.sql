-- Código de la tabla de Aduana del SII en los mantenedores que alimentan el
-- bloque Aduana del DTE 110 (Factura de Exportación). Hoy enviamos a LibreDTE el
-- `codigo` de negocio (ej. "FOB", "MARITIMO"), que el SII descarta porque espera
-- el código numérico de SUS tablas. Se agrega `codigoAduana` (nullable) para
-- normalizar y mandar el valor correcto; el service valida que esté presente
-- antes de enviar a simpleDTE.
ALTER TABLE "clausulas_venta" ADD COLUMN "codigoAduana" TEXT;
ALTER TABLE "tipos_embarque" ADD COLUMN "codigoAduana" TEXT;
ALTER TABLE "puertos" ADD COLUMN "codigoAduana" TEXT;
ALTER TABLE "paises" ADD COLUMN "codigoAduana" TEXT;
ALTER TABLE "parametros" ADD COLUMN "codigoAduana" TEXT;
