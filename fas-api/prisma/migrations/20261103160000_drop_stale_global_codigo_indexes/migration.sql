-- Borra un índice único parcial OBSOLETO sobre (codigo) SOLO en grupos_mercado,
-- creado antes de multiempresa (migración 20260713_add_unique_partial_indexes).
--
-- Al pasar a multiempresa se agregó el índice correcto por empresa
-- (grupos_mercado_empresa_codigo_activo_key sobre (empresaId, codigo), Fase 2a
-- 20260801100000) pero NO se borró el global. La migración de Fase 3
-- (20260803100000) sí borró los índices globales de los OTROS mantenedores
-- (tipos_embarque, unidades_medida, tipos_pallet, alturas, tipos_produccion,
-- tipos_defecto, tipos_parametro), pero grupos_mercado quedó fuera de esa lista
-- y su índice global sobrevivió.
--
-- Efecto del bug: el `codigo` de grupos_mercado quedaba único ENTRE empresas, así
-- que dos empresas no podían tener el mismo código (ej. no se podía crear el
-- GrupoMercado "TODOS" en AGDRY y en AGROSAN LLC a la vez). Al borrarlo, queda
-- vigente solo el índice correcto por (empresaId, codigo).
--
-- Los índices globales legítimos (paises, zonas — maestros sin empresaId) NO se
-- tocan. IF EXISTS para ser idempotente ante drift entre ambientes.

DROP INDEX IF EXISTS "grupos_mercado_codigo_activo_idx";
