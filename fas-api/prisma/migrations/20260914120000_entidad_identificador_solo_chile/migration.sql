-- Identificador (RUT) único SOLO para entidades chilenas.
-- Las entidades extranjeras (país ≠ Chile) no tienen RUT chileno y pueden
-- compartir un identificador placeholder (ej. 55555555-5). Como el flag de
-- país nacional no es una columna de `entidades`, no se puede expresar un
-- índice parcial "solo Chile"; la unicidad del RUT chileno queda enforced en
-- la capa de servicio (entidades.service.ts), que ya la valida.
DROP INDEX IF EXISTS "entidades_empresa_identificador_activo_key";
