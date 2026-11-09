# Plan — Tipo de cambio en Proforma de Materiales + fuentes de TC con prioridad — nov-2026

Fecha: 2026-11-09 · Alcance QA: `tipo-cambio-fuentes-nov2026`

## Pedido / decisiones del usuario (2026-11-09)
1. Proforma de Materiales con tipo de cambio **igual que la Proforma de Servicios**.
2. La API de TC (mindicador.cl) falla casi siempre → fuentes configurables en **Configuración → Integraciones**, más
   de una, **con prioridad**; si una falla se consulta la siguiente.
3. Aprobado: fuentes **CMF → Banco Central → mindicador**, **respaldo local**, adaptadores listos aunque aún no hay
   credenciales reales (CMF API key / usuario Banco Central).

## Cambios
- Migración `20261109120000_tipo_cambio_fuentes`: `integraciones.prioridad`, `proformas_material.tipoCambio`,
  tabla global `tipos_cambio_historico` (unique moneda+fechaConsulta), seed `TC_MINDICADOR` prioridad 3 por empresa
  (`ON CONFLICT DO NOTHING`).
- `finanzas/facturacion/tipo-cambio.fuentes.ts`: adaptadores `TC_CMF` (API_KEY), `TC_BCENTRAL` (USUARIO/PASSWORD,
  series F073.TCO.PRE.Z.D / F072.CLP.EUR.N.O.D), `TC_MINDICADOR`; ventana de 10 días hacia atrás para el día hábil
  ≤ fecha; `url` de la Integración reemplaza la base.
- `tipo-cambio.adapter.ts` (`obtenerTipoCambio`, misma firma + `fuente`): caché exacta si la fecha ya pasó →
  fuentes activas por prioridad (fallback mindicador si no hay ninguna) → respaldo cercano (≤ 10 días). Guarda solo
  valores definitivos. Mensaje de error final con el motivo de cada fuente.
- Integraciones: `prioridad` (1–99) en schema/types/UI (visible si el código es `TC_*`, con ayuda de códigos y
  parámetros); crear un `TC_*` no soportado → 422.
- Proforma de Materiales: `tipoCambio` en schema/types/repo; service valida y normaliza igual que Proforma de
  Servicios (crear/editar/enviar a validación); `GET /api/materiales/proformas/tipo-cambio`; form con campo +
  "Obtener".
- Factura Nacional desde Proforma de Materiales: convierte a CLP con el TC (precio origen en `precioUnitarioOrigen`,
  moneda CLP, `tipoCambio` en la factura) en vez de rechazar monedas ≠ CLP.
- Docs: `Docs/integraciones.md`, `Docs/materiales.md`.

## Verificado por Claude
- `tsc` API y web, ESLint de los archivos web tocados, `prisma validate`, migración aplicada en `fas_test`.
- Prueba con fuentes reales: mindicador falló (fetch failed / timeout / 500). Con TC_CMF (prio 1) y TC_BCENTRAL
  (prio 2) sin credenciales + respaldo: orden CMF → Banco Central → mindicador → respaldo correcto; fecha pasada
  guardada servida sin llamar; sin respaldo → error con el detalle de cada fuente.

## Riesgos
- Formatos de CMF y Banco Central implementados según su documentación pública; sin credenciales no se validaron
  contra el servicio real.
- El respaldo cercano puede devolver la paridad de un día hábil anterior (se informa la fecha de la paridad).

## QA ronda 1 (2026-11-09) — correcciones aprobadas
- TCQA-R1-001 (Media): al crear una Integración `TC_*` el código se normaliza a mayúsculas antes de validar
  soporte y unicidad, y se persiste canónico (`tc_cmf` → `TC_CMF`).
- TCQA-R1-002 (Baja): `fecha` del endpoint de TC valida fecha calendario real en Proforma de Materiales **y** en
  Proforma de Servicios (mismo defecto preexistente); `obtenerTipoCambio` rechaza `Date` inválida con mensaje.

## QA ronda 2 (2026-11-09) — TCQA-R2-003 (Baja)
- `ultimoHasta()` aplica la ventana de 10 días (`fecha >= hasta − 10 días`) para TODAS las fuentes; mindicador (que
  descarga el año completo, y el año anterior en el borde de enero) ya no puede devolver ni guardar un valor más
  antiguo. Sin fecha, mindicador también usa la ventana respecto de hoy.
