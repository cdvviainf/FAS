-- Estado RECHAZADA para la Proforma a Productor: al previsualizarla en
-- ENVIADA_VALIDACION el usuario puede rechazarla; queda editable como BORRADOR
-- para corregirla y reenviarla a validación (nueva generación).
ALTER TYPE "EstadoProformaProductor" ADD VALUE IF NOT EXISTS 'RECHAZADA' BEFORE 'FACTURADA';
