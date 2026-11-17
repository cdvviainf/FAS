-- Temporada obligatoria en TODAS las cabeceras transaccionales (2026-11-16).
-- Regla del negocio: la empresa y la temporada del selector superior rigen
-- todo lo que se registra. Esta migración agrega temporadaId a las 17
-- cabeceras que no lo tenían y completa los registros existentes:
--
--   * Documentos hijos → la temporada de su padre (no existen hijos de otra
--     temporada): Embarque ← Cierre; Reserva/Packing List/Instructivo hijo/
--     Proforma/Factura Exportación ← Embarque; Pallet ← Recepción; Provisión ←
--     Reclamo; Saldo a favor ← Pago; Movimiento ← OC Materiales o movimiento
--     original (inverso); Proforma Materiales ← Movimiento; Factura Nacional ←
--     Proforma Materiales / Proforma Productor / Embarque; NC ← Factura.
--   * Documentos sin padre → regla de corte del negocio: fecha desde el
--     2026-11-01 = temporada "2026-2027"; antes = "2025-2026". La temporada se
--     busca en la empresa del registro por código (o descripción que lo
--     contenga); si la empresa no la tiene, por rango de fechas, luego la
--     predeterminada y por último la más reciente.
--   * Falla con un mensaje explícito si queda algún registro sin temporada
--     (empresa sin ninguna temporada creada).

-- 1) Columnas (nullable mientras se completan).
ALTER TABLE "embarques" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "solicitudes_reserva" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "embarque_packing_lists" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "instructivos_hijos" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "pallets" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "proformas" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "facturas_exportacion" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "facturas_nacional" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "notas_credito" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "provisiones" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "pagos" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "saldos_a_favor_cliente" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "movimientos" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "ordenes_compra_material" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "proformas_material" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "proformas_productor" ADD COLUMN "temporadaId" INTEGER;
ALTER TABLE "documentos_manuales" ADD COLUMN "temporadaId" INTEGER;

-- 2) Regla de corte (función auxiliar, se elimina al final).
CREATE FUNCTION "fas_temporada_corte_20261116"(p_empresa integer, p_fecha date) RETURNS integer
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_nombre text := CASE WHEN p_fecha >= DATE '2026-11-01' THEN '2026-2027' ELSE '2025-2026' END;
  v_id integer;
BEGIN
  SELECT t."id" INTO v_id FROM "temporadas" t
   WHERE t."empresaId" = p_empresa AND t."eliminadoEn" IS NULL
     AND (t."codigo" = v_nombre OR t."descripcion" ILIKE '%' || v_nombre || '%')
   ORDER BY (t."codigo" = v_nombre) DESC, t."id" DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT t."id" INTO v_id FROM "temporadas" t
   WHERE t."empresaId" = p_empresa AND t."eliminadoEn" IS NULL
     AND t."fechaInicio" <= p_fecha AND t."fechaTermino" >= p_fecha
   ORDER BY t."fechaInicio" DESC, t."id" DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT t."id" INTO v_id FROM "temporadas" t
   WHERE t."empresaId" = p_empresa AND t."eliminadoEn" IS NULL AND t."predeterminada" = true
   ORDER BY t."id" DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT t."id" INTO v_id FROM "temporadas" t
   WHERE t."empresaId" = p_empresa
   ORDER BY (t."eliminadoEn" IS NULL) DESC, t."fechaInicio" DESC, t."id" DESC LIMIT 1;
  RETURN v_id;
END $$;

-- 3) Backfill. Primero padres/raíces, después hijos.

-- Embarque ← Cierre (notaVentaId obligatorio).
UPDATE "embarques" e SET "temporadaId" = nv."temporadaId"
  FROM "notas_venta" nv
 WHERE nv."empresaId" = e."empresaId" AND nv."id" = e."notaVentaId" AND e."temporadaId" IS NULL;

-- Hijos del Embarque.
UPDATE "solicitudes_reserva" x SET "temporadaId" = e."temporadaId"
  FROM "embarques" e WHERE e."empresaId" = x."empresaId" AND e."id" = x."embarqueId" AND x."temporadaId" IS NULL;
UPDATE "embarque_packing_lists" x SET "temporadaId" = e."temporadaId"
  FROM "embarques" e WHERE e."empresaId" = x."empresaId" AND e."id" = x."embarqueId" AND x."temporadaId" IS NULL;
UPDATE "instructivos_hijos" x SET "temporadaId" = e."temporadaId"
  FROM "embarques" e WHERE e."empresaId" = x."empresaId" AND e."id" = x."embarqueId" AND x."temporadaId" IS NULL;
UPDATE "proformas" x SET "temporadaId" = e."temporadaId"
  FROM "embarques" e WHERE e."empresaId" = x."empresaId" AND e."id" = x."embarqueId" AND x."temporadaId" IS NULL;
UPDATE "facturas_exportacion" x SET "temporadaId" = e."temporadaId"
  FROM "embarques" e WHERE e."empresaId" = x."empresaId" AND e."id" = x."embarqueId" AND x."temporadaId" IS NULL;

-- Pallet ← Recepción.
UPDATE "pallets" x SET "temporadaId" = r."temporadaId"
  FROM "recepciones" r WHERE r."empresaId" = x."empresaId" AND r."id" = x."recepcionId" AND x."temporadaId" IS NULL;

-- Provisión ← Reclamo.
UPDATE "provisiones" x SET "temporadaId" = r."temporadaId"
  FROM "reclamos" r WHERE r."empresaId" = x."empresaId" AND r."id" = x."reclamoId" AND x."temporadaId" IS NULL;

-- Pago (raíz) → corte por fecha del pago.
UPDATE "pagos" x SET "temporadaId" = "fas_temporada_corte_20261116"(x."empresaId", x."fecha"::date)
 WHERE x."temporadaId" IS NULL;

-- Saldo a favor ← Pago de origen; sin pago → corte por su fecha.
UPDATE "saldos_a_favor_cliente" x SET "temporadaId" = p."temporadaId"
  FROM "pagos" p WHERE p."empresaId" = x."empresaId" AND p."id" = x."pagoOrigenId" AND x."temporadaId" IS NULL;
UPDATE "saldos_a_favor_cliente" x SET "temporadaId" = "fas_temporada_corte_20261116"(x."empresaId", x."fecha"::date)
 WHERE x."temporadaId" IS NULL;

-- OC Materiales (raíz) → corte por fecha.
UPDATE "ordenes_compra_material" x SET "temporadaId" = "fas_temporada_corte_20261116"(x."empresaId", x."fecha"::date)
 WHERE x."temporadaId" IS NULL;

-- Movimiento ← OC Materiales; resto → corte por fecha del movimiento; los
-- inversos copian después la del movimiento original.
UPDATE "movimientos" x SET "temporadaId" = oc."temporadaId"
  FROM "ordenes_compra_material" oc
 WHERE oc."empresaId" = x."empresaId" AND oc."id" = x."ordenCompraMaterialId" AND x."temporadaId" IS NULL;
UPDATE "movimientos" x SET "temporadaId" = "fas_temporada_corte_20261116"(x."empresaId", x."fechaMovimiento"::date)
 WHERE x."temporadaId" IS NULL;
UPDATE "movimientos" x SET "temporadaId" = o."temporadaId"
  FROM "movimientos" o
 WHERE o."empresaId" = x."empresaId" AND o."id" = x."movimientoInversoDeId";

-- Proforma Materiales ← Movimiento.
UPDATE "proformas_material" x SET "temporadaId" = m."temporadaId"
  FROM "movimientos" m WHERE m."empresaId" = x."empresaId" AND m."id" = x."movimientoId" AND x."temporadaId" IS NULL;

-- Proforma Productor (raíz) → corte por fecha de creación.
UPDATE "proformas_productor" x SET "temporadaId" = "fas_temporada_corte_20261116"(x."empresaId", x."creadoEn"::date)
 WHERE x."temporadaId" IS NULL;

-- Factura Nacional ← Proforma Materiales / Proforma Productor / Embarque; sin
-- padre → corte por fecha del documento.
UPDATE "facturas_nacional" x SET "temporadaId" = pm."temporadaId"
  FROM "proformas_material" pm WHERE pm."empresaId" = x."empresaId" AND pm."id" = x."proformaMaterialId" AND x."temporadaId" IS NULL;
UPDATE "facturas_nacional" x SET "temporadaId" = pp."temporadaId"
  FROM "proformas_productor" pp WHERE pp."empresaId" = x."empresaId" AND pp."id" = x."proformaProductorId" AND x."temporadaId" IS NULL;
UPDATE "facturas_nacional" x SET "temporadaId" = e."temporadaId"
  FROM "embarques" e WHERE e."empresaId" = x."empresaId" AND e."id" = x."embarqueId" AND x."temporadaId" IS NULL;
UPDATE "facturas_nacional" x SET "temporadaId" = "fas_temporada_corte_20261116"(
    x."empresaId", COALESCE(x."fechaDocumento", x."fechaEmision", x."creadoEn")::date)
 WHERE x."temporadaId" IS NULL;

-- Nota de Crédito ← Factura (exportación o nacional); respaldo → corte.
UPDATE "notas_credito" x SET "temporadaId" = f."temporadaId"
  FROM "facturas_exportacion" f WHERE f."empresaId" = x."empresaId" AND f."id" = x."facturaExportacionId" AND x."temporadaId" IS NULL;
UPDATE "notas_credito" x SET "temporadaId" = f."temporadaId"
  FROM "facturas_nacional" f WHERE f."empresaId" = x."empresaId" AND f."id" = x."facturaNacionalId" AND x."temporadaId" IS NULL;
UPDATE "notas_credito" x SET "temporadaId" = "fas_temporada_corte_20261116"(x."empresaId", x."creadoEn"::date)
 WHERE x."temporadaId" IS NULL;

-- Generador DTE (raíz) → corte por fecha del documento.
UPDATE "documentos_manuales" x SET "temporadaId" = "fas_temporada_corte_20261116"(x."empresaId", x."fechaDocumento"::date)
 WHERE x."temporadaId" IS NULL;

DROP FUNCTION "fas_temporada_corte_20261116"(integer, date);

-- 4) Nada puede quedar sin temporada.
DO $$
DECLARE
  tabla text;
  pendientes integer;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['embarques','solicitudes_reserva','embarque_packing_lists','instructivos_hijos','pallets',
    'proformas','facturas_exportacion','facturas_nacional','notas_credito','provisiones','pagos','saldos_a_favor_cliente',
    'movimientos','ordenes_compra_material','proformas_material','proformas_productor','documentos_manuales'] LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE "temporadaId" IS NULL', tabla) INTO pendientes;
    IF pendientes > 0 THEN
      RAISE EXCEPTION 'Temporada obligatoria: % registro(s) de % quedaron sin temporada (su empresa no tiene temporadas o su documento padre no existe). Crea la temporada en esa empresa y vuelve a ejecutar la migración.', pendientes, tabla;
    END IF;
  END LOOP;
END $$;

-- 5) NOT NULL + FK compuesta (empresaId, temporadaId) → temporadas(empresaId, id) + índice.
DO $$
DECLARE
  tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['embarques','solicitudes_reserva','embarque_packing_lists','instructivos_hijos','pallets',
    'proformas','facturas_exportacion','facturas_nacional','notas_credito','provisiones','pagos','saldos_a_favor_cliente',
    'movimientos','ordenes_compra_material','proformas_material','proformas_productor','documentos_manuales'] LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "temporadaId" SET NOT NULL', tabla);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("empresaId", "temporadaId") REFERENCES "temporadas"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE',
      tabla, tabla || '_empresaId_temporadaId_fkey');
    EXECUTE format('CREATE INDEX %I ON %I ("temporadaId")', tabla || '_temporadaId_idx', tabla);
  END LOOP;
END $$;
