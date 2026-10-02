-- Corrige pesos de envase mal cargados en artículos de EMBALAJE, necesarios para
-- el PesoNeto/PesoBruto del bloque Aduana del DTE 110. Todo el catálogo de
-- embalaje de 8.2 kg neto usa bruto 9.2 (envase = 1.0 kg); estos quedaron mal en
-- la carga original: 6 con bruto en 0 y 1 con neto/bruto invertidos.

-- (1) Bruto en 0 con neto 8.2 -> bruto 9.2 (familia uniforme ctn/mdr/ptc slider/zipper).
UPDATE "articulos"
  SET "kgBrutoEnvase" = 9.2
  WHERE "tipo" = 'EMBALAJE' AND "kgNetoEnvase" = 8.2 AND COALESCE("kgBrutoEnvase", 0) = 0;

-- (2) Invertidos (neto 9.2 / bruto 8.2, imposible: el bruto siempre >= neto) -> 8.2 / 9.2.
UPDATE "articulos"
  SET "kgNetoEnvase" = 8.2, "kgBrutoEnvase" = 9.2
  WHERE "tipo" = 'EMBALAJE' AND "kgNetoEnvase" = 9.2 AND "kgBrutoEnvase" = 8.2;
