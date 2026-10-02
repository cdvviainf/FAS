-- Códigos de Aduana del SII para PUERTOS (embarque y destino), tomados de la
-- tabla oficial que usa LibreDTE (resources/data/repository/aduana_puertos.php).
-- Estrategia: (A) puerto individualizado por el SII -> su código exacto, por
-- nombre (ILIKE, ES/EN). (B) el resto -> "Otros puertos de <país>" según el país
-- del puerto, para que todo puerto quede con un código válido. Solo donde
-- codigoAduana IS NULL (no pisa cargas manuales).

-- ── (A) Puertos chilenos de embarque ──────────────────────────────────────────
UPDATE "puertos" SET "codigoAduana"='901' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%arica%';
UPDATE "puertos" SET "codigoAduana"='902' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%iquique%';
UPDATE "puertos" SET "codigoAduana"='903' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%antofagasta%';
UPDATE "puertos" SET "codigoAduana"='915' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%mejillones%';
UPDATE "puertos" SET "codigoAduana"='904' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%coquimbo%';
UPDATE "puertos" SET "codigoAduana"='905' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%valpara%';
UPDATE "puertos" SET "codigoAduana"='906' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%san antonio%';
UPDATE "puertos" SET "codigoAduana"='907' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%talcahuano%';
UPDATE "puertos" SET "codigoAduana"='908' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%san vicente%';
UPDATE "puertos" SET "codigoAduana"='909' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%lirqu%';
UPDATE "puertos" SET "codigoAduana"='926' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%coronel%';
UPDATE "puertos" SET "codigoAduana"='910' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%puerto montt%';
UPDATE "puertos" SET "codigoAduana"='911' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%chacabuco%';
UPDATE "puertos" SET "codigoAduana"='912' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%punta arenas%';
UPDATE "puertos" SET "codigoAduana"='918' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%caldera%';

-- ── (A) Puertos de destino individualizados ──────────────────────────────────
-- USA
UPDATE "puertos" SET "codigoAduana"='135' WHERE "codigoAduana" IS NULL AND ("descripcion" ILIKE '%filadelfia%' OR "descripcion" ILIKE '%philadelphia%');
UPDATE "puertos" SET "codigoAduana"='174' WHERE "codigoAduana" IS NULL AND ("descripcion" ILIKE '%los angeles%' OR "descripcion" ILIKE '%los ángeles%');
UPDATE "puertos" SET "codigoAduana"='175' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%long beach%';
UPDATE "puertos" SET "codigoAduana"='160' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%oakland%';
UPDATE "puertos" SET "codigoAduana"='134' WHERE "codigoAduana" IS NULL AND ("descripcion" ILIKE '%new york%' OR "descripcion" ILIKE '%nueva york%');
UPDATE "puertos" SET "codigoAduana"='141' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%miami%';
UPDATE "puertos" SET "codigoAduana"='159' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%houston%';
UPDATE "puertos" SET "codigoAduana"='140' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%savannah%';
UPDATE "puertos" SET "codigoAduana"='171' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%seattle%';
UPDATE "puertos" SET "codigoAduana"='138' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%wilmington%';
-- Europa
UPDATE "puertos" SET "codigoAduana"='622' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%rotterdam%';
UPDATE "puertos" SET "codigoAduana"='592' WHERE "codigoAduana" IS NULL AND ("descripcion" ILIKE '%hamburg%' OR "descripcion" ILIKE '%hamburgo%');
UPDATE "puertos" SET "codigoAduana"='601' WHERE "codigoAduana" IS NULL AND ("descripcion" ILIKE '%amberes%' OR "descripcion" ILIKE '%antwerp%');
UPDATE "puertos" SET "codigoAduana"='572' WHERE "codigoAduana" IS NULL AND ("descripcion" ILIKE '%london%' OR "descripcion" ILIKE '%londres%');
UPDATE "puertos" SET "codigoAduana"='577' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%dover%';
UPDATE "puertos" SET "codigoAduana"='563' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%barcelona%';
-- Asia
UPDATE "puertos" SET "codigoAduana"='411' WHERE "codigoAduana" IS NULL AND ("descripcion" ILIKE '%shangai%' OR "descripcion" ILIKE '%shanghai%');
UPDATE "puertos" SET "codigoAduana"='492' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%hong kong%';
UPDATE "puertos" SET "codigoAduana"='422' WHERE "codigoAduana" IS NULL AND ("descripcion" ILIKE '%busan%' OR "descripcion" ILIKE '%pusan%');
UPDATE "puertos" SET "codigoAduana"='452' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%keelung%';
UPDATE "puertos" SET "codigoAduana"='451' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%kaohsiung%';
UPDATE "puertos" SET "codigoAduana"='444' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%yokohama%';
UPDATE "puertos" SET "codigoAduana"='443' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%kobe%';
-- Latinoamérica
UPDATE "puertos" SET "codigoAduana"='252' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%callao%';
UPDATE "puertos" SET "codigoAduana"='242' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%guayaquil%';
UPDATE "puertos" SET "codigoAduana"='292' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%santos%';
UPDATE "puertos" SET "codigoAduana"='213' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%veracruz%';
UPDATE "puertos" SET "codigoAduana"='217' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%manzanillo%';
UPDATE "puertos" SET "codigoAduana"='232' WHERE "codigoAduana" IS NULL AND "descripcion" ILIKE '%buenaventura%';

-- ── (B) Fallback: "Otros puertos de <país>" por el país del puerto ────────────
-- Para los puertos que no quedaron individualizados arriba. El SII acepta estos
-- códigos genéricos por país. Se mapea por el ISO alfa-3 del país del puerto.
UPDATE "puertos" p SET "codigoAduana" = m.cod
FROM "paises" pa, (VALUES
  ('CHL','997'), ('USA','180'), ('COL','231'), ('ECU','241'), ('PER','251'),
  ('ARG','261'), ('URY','271'), ('VEN','281'), ('BRA','291'), ('MEX','210'),
  ('PAN','224'), ('CHN','413'), ('KOR','423'), ('TWN','453'), ('JPN','441'),
  ('IND','472'), ('SGP','491'), ('ESP','561'), ('ITA','541'), ('FRA','551'),
  ('GBR','576'), ('NLD','623'), ('DEU','596'), ('BEL','602'), ('PRT','612'),
  ('SWE','632'), ('DNK','643'), ('NOR','652'), ('FIN','582'), ('ZAF','713'),
  ('AUS','813')
) AS m(iso, cod)
WHERE p."paisId" = pa."id" AND pa."codigo" = m.iso AND p."codigoAduana" IS NULL;
