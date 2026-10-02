-- Corrección de códigos de Aduana del SII contra la tabla oficial (verificada
-- con libredte-lib, que es lo que valida/normaliza LibreDTE).

-- (1) CLÁUSULA DE VENTA — la migración 20261001170000 había invertido FOB/EXW
-- por un supuesto equivocado. Tabla real del SII: 1=CIF, 2=CFR, 3=EXW, 5=FOB.
-- Se corrige de forma incondicional (los valores previos estaban mal).
UPDATE "clausulas_venta" SET "codigoAduana" = '5' WHERE "codigo" = 'FOB';
UPDATE "clausulas_venta" SET "codigoAduana" = '3' WHERE "codigo" = 'EXW';
UPDATE "clausulas_venta" SET "codigoAduana" = '1' WHERE "codigo" = 'CIF';
UPDATE "clausulas_venta" SET "codigoAduana" = '2' WHERE "codigo" = 'CFR';

-- (2) PAÍS — código de la tabla de Aduana del SII por ISO alfa-3 (nuestro
-- `codigo`), para los mercados de exportación habituales. Solo donde falta.
UPDATE "paises" SET "codigoAduana"='997' WHERE "codigo"='CHL' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='202' WHERE "codigo"='COL' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='225' WHERE "codigo"='USA' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='336' WHERE "codigo"='CHN' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='219' WHERE "codigo"='PER' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='220' WHERE "codigo"='BRA' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='515' WHERE "codigo"='NLD' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='510' WHERE "codigo"='GBR' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='517' WHERE "codigo"='ESP' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='563' WHERE "codigo"='DEU' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='226' WHERE "codigo"='CAN' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='216' WHERE "codigo"='MEX' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='218' WHERE "codigo"='ECU' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='224' WHERE "codigo"='ARG' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='317' WHERE "codigo"='IND' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='333' WHERE "codigo"='KOR' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='331' WHERE "codigo"='JPN' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='330' WHERE "codigo"='TWN' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='342' WHERE "codigo"='HKG' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='341' WHERE "codigo"='ARE' AND "codigoAduana" IS NULL;
UPDATE "paises" SET "codigoAduana"='562' WHERE "codigo"='RUS' AND "codigoAduana" IS NULL;

-- (3) PUERTOS chilenos de embarque (best-effort por nombre; solo donde falta).
-- Los puertos de destino extranjeros se cargan manual (nombres muy variables).
UPDATE "puertos" SET "codigoAduana"='905' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%valpara%';
UPDATE "puertos" SET "codigoAduana"='906' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%san antonio%';
UPDATE "puertos" SET "codigoAduana"='904' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%coquimbo%';
UPDATE "puertos" SET "codigoAduana"='901' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%arica%';
UPDATE "puertos" SET "codigoAduana"='902' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%iquique%';
UPDATE "puertos" SET "codigoAduana"='903' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%antofagasta%';
UPDATE "puertos" SET "codigoAduana"='907' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%talcahuano%';
UPDATE "puertos" SET "codigoAduana"='908' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%san vicente%';
UPDATE "puertos" SET "codigoAduana"='909' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%lirqu%';
UPDATE "puertos" SET "codigoAduana"='910' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%puerto montt%';
