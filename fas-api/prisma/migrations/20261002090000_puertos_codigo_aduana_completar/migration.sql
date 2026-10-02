-- Completar/afinar los códigos de Aduana del SII de TODOS los puertos, contra la
-- tabla oficial de LibreDTE (aduana_puertos.php). Match exacto por nombre (y país
-- donde hay riesgo de colisión). Ningún puerto queda sin código: específico donde
-- el SII lo individualiza, "Otros puertos de <país>" o catch-all regional
-- (399=América, 499=Asiáticos, 699=Europa, 301=Antillas) para el resto.

-- ── (1) Upgrades a código específico (solo si está en el valor previo esperado,
--        para no pisar una corrección manual) ──────────────────────────────────
UPDATE "puertos" SET "codigoAduana"='233' WHERE upper(trim("descripcion"))='BARRANQUILLA' AND "codigoAduana"='231';
UPDATE "puertos" SET "codigoAduana"='611' WHERE upper(trim("descripcion"))='LISBOA'       AND "codigoAduana"='612';
UPDATE "puertos" SET "codigoAduana"='442' WHERE upper(trim("descripcion"))='OSAKA'         AND "codigoAduana"='441';
UPDATE "puertos" SET "codigoAduana"='111' WHERE upper(trim("descripcion"))='MONTREAL'      AND "codigoAduana" IS NULL;

-- ── (2) Fix de colisión de nombre: "Puerto Caldera" (Costa Rica) tomó por ILIKE
--        el código de Caldera (Chile, 918). Costa Rica no tiene código de país en
--        la tabla → catch-all América (399). ───────────────────────────────────
UPDATE "puertos" p SET "codigoAduana"='399'
FROM "paises" pa
WHERE p."paisId"=pa."id" AND upper(trim(p."descripcion"))='PUERTO CALDERA'
  AND pa."codigo"='CRI' AND p."codigoAduana"='918';

-- ── (3) Nulls restantes → "Otros puertos de <país>" / catch-all regional, por el
--        país del puerto. Solo donde codigoAduana IS NULL. ─────────────────────
UPDATE "puertos" p SET "codigoAduana" = m.cod
FROM "paises" pa, (VALUES
  ('ARE','499'),  -- Emiratos (Jebel Ali) → otros asiáticos
  ('DOM','301'),  -- Rep. Dominicana (Caucedo) → otros Antillas
  ('GLP','301'),  -- Guadalupe (Pointe-à-Pitre) → otros Antillas
  ('GTM','399'),  -- Guatemala (Puerto Quetzal) → otros América
  ('GUF','399'),  -- Guayana Francesa (Dégrad des Cannes) → otros América
  ('HND','399'),  -- Honduras (Puerto Cortés, San Pedro Sula) → otros América
  ('IDN','499'),  -- Indonesia (Yakarta, Surabaya) → otros asiáticos
  ('KHM','499'),  -- Camboya (Sihanoukville) → otros asiáticos
  ('KWT','499'),  -- Kuwait (Shuwaikh) → otros asiáticos
  ('MTQ','301'),  -- Martinica (Fort-de-France) → otros Antillas
  ('MYS','499'),  -- Malasia (Port Klang) → otros asiáticos
  ('OMN','499'),  -- Omán (Sohar) → otros asiáticos
  ('RUS','699'),  -- Rusia (Moscú, San Petersburgo) → otros Europa
  ('SAU','499'),  -- Arabia Saudita (Jeddah, King Abdullah) → otros asiáticos
  ('SLV','399'),  -- El Salvador (Acajutla, San Salvador) → otros América
  ('THA','499'),  -- Tailandia (Laem Chabang) → otros asiáticos
  ('TUR','699'),  -- Turquía (Mersin) → otros Europa
  ('VNM','499')   -- Vietnam (Ho Chi Minh) → otros asiáticos
) AS m(iso, cod)
WHERE p."paisId"=pa."id" AND pa."codigo"=m.iso AND p."codigoAduana" IS NULL;
