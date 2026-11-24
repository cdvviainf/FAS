-- Empresa.emiteGuiaDespachoSistema (2026-11-24): si es false, en el Packing List
-- la empresa como Emisor de la Guía es un tercero (N° de guía obligatorio,
-- emisor = Entidad con el RUT de la empresa).
ALTER TABLE "empresas" ADD COLUMN "emiteGuiaDespachoSistema" BOOLEAN NOT NULL DEFAULT true;
