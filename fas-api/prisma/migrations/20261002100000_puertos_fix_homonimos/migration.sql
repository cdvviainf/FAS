-- FAS-EXP-ADU-QA-004: los backfills de puertos (20261001180000/190000) asignaron
-- códigos específicos por `descripcion ILIKE` SIN filtrar país, así que un puerto
-- homónimo de OTRO país pudo tomar un código específico que no le corresponde
-- (ej. "Barcelona" de Venezuela tomando el código de Barcelona/España; "Caldera"
-- de Costa Rica tomando el de Caldera/Chile).
--
-- Corrección país-scoped y GENERAL (Chile/extranjero y extranjero/extranjero):
-- cualquier puerto cuyo `codigoAduana` sea un código ESPECÍFICO que pertenece a
-- un país distinto al suyo, vuelve al catch-all de SU propio país. El puerto del
-- país dueño conserva su código específico (esp.owner = su país → excluido).
--
-- Estrategia para países SIN catch-all conocido (fuera de `fb`): el LEFT JOIN deja
-- fb.cod en NULL, así `validarCodigosAduana` bloquea el envío al SII y obliga a
-- cargar el código correcto a mano, en vez de mandar el código válido de OTRO país.
UPDATE "puertos" p SET "codigoAduana" = fb.cod
FROM "paises" pa
  CROSS JOIN (VALUES  -- código específico -> país dueño
       ('901','CHL'),('902','CHL'),('903','CHL'),('904','CHL'),('905','CHL'),('906','CHL'),
       ('907','CHL'),('908','CHL'),('909','CHL'),('910','CHL'),('911','CHL'),('912','CHL'),
       ('915','CHL'),('918','CHL'),('926','CHL'),
       ('134','USA'),('135','USA'),('138','USA'),('140','USA'),('141','USA'),('159','USA'),
       ('160','USA'),('171','USA'),('174','USA'),('175','USA'),
       ('563','ESP'),('622','NLD'),('592','DEU'),('601','BEL'),('572','GBR'),('577','GBR'),
       ('411','CHN'),('492','CHN'),('422','KOR'),('451','TWN'),('452','TWN'),
       ('442','JPN'),('443','JPN'),('444','JPN'),('252','PER'),('242','ECU'),('292','BRA'),
       ('213','MEX'),('217','MEX'),('232','COL'),('233','COL'),('111','CAN'),('611','PRT')
     ) AS esp(code, owner)
  LEFT JOIN (VALUES  -- país del puerto -> su catch-all (específico "otros" / regional)
       ('CHL','997'),('USA','180'),('COL','231'),('ECU','241'),('PER','251'),('ARG','261'),
       ('URY','271'),('VEN','281'),('BRA','291'),('MEX','210'),('PAN','224'),('CAN','117'),
       ('CHN','413'),('KOR','423'),('TWN','453'),('JPN','441'),('IND','472'),('SGP','491'),
       ('ESP','561'),('ITA','541'),('FRA','551'),('GBR','576'),('NLD','623'),('DEU','596'),
       ('BEL','602'),('PRT','612'),('SWE','632'),('DNK','643'),('NOR','652'),('FIN','582'),
       ('SLV','399'),('DOM','301'),('GTM','399'),('GUF','399'),('HND','399'),('CRI','399'),
       ('GLP','301'),('MTQ','301'),('VNM','499'),('IDN','499'),('THA','499'),('MYS','499'),
       ('KHM','499'),('ARE','499'),('SAU','499'),('KWT','499'),('OMN','499'),('RUS','699'),('TUR','699')
     ) AS fb(iso, cod) ON fb.iso = pa."codigo"
WHERE p."paisId" = pa."id"
  AND esp.code = p."codigoAduana"
  AND esp.owner <> pa."codigo";
