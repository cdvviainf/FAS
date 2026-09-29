-- Backfill (2026-09-28, FAS-DEV-QA-R1-005b): los Packing List OK activos creados
-- bajo la semántica anterior (un archivo cubría TODOS los pallets reservados)
-- quedan con numerosPallet = [] tras agregar la columna. Se rellenan con los N°
-- de pallet reservados de su Embarque para que la cobertura (unión) siga
-- habilitando el despacho — sin esto, un Embarque ya reconciliado no podría
-- despacharse hasta re-subir el archivo.
UPDATE "embarque_packing_lists" pl
SET "numerosPallet" = COALESCE(
  (SELECT jsonb_agg(p."numeroPallet") FROM "pallets" p WHERE p."embarqueId" = pl."embarqueId"),
  '[]'::jsonb
)
WHERE pl."eliminadoEn" IS NULL
  AND pl."estado" = 'OK'
  AND pl."numerosPallet" = '[]'::jsonb;
