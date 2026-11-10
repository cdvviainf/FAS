# Plan — Cierre de inspección en dos pasos + Inspector Calidad + PDF v3 (2026-11-10)

Pedido del usuario sobre el cierre de la Solicitud de Inspección (Calidad). Decisiones del usuario (respuestas 1–5 + OK):
1. Al pinchar fuera de la ventana no se deben perder los datos.
2. Notificados: lista fija no cambiable. "Quién asiste": desplegable solo con usuarios que tengan el permiso especial "Inspector Calidad", más la opción "Servicio Tercero" (con nombre obligatorio, recomendación aceptada).
3. "Características de calidad/madurez" → "Indicadores de madurez" en todas partes.
4. Primero grabar y luego cerrar: en el menú de opciones del listado, "Editar inspección" (graba) y "Cerrar inspección" (solo cambia el estado).
5. Reabrir: sin cambios (no considerar).
6. PDF: el "Resultado por línea" se superponía con la variedad; defectos uno por fila (no horizontal).

## 1. Ventana "Editar inspección"
- `DialogContent` con `onInteractOutside` y `onEscapeKeyDown` → `preventDefault`: solo se cierra con Cancelar / X.
- Botón único **Guardar**: sube adjuntos pendientes y llama `PUT /api/calidad/solicitudes/:id/cierre`. Cierra la ventana al guardar. Al reabrir la ventana se precargan los datos guardados (incluye comentarios y Servicio Tercero).
- Solicitudes legacy sin líneas: el veredicto de cabecera se elige al Cerrar (no hay dónde guardarlo en borrador); en Editar se registran defectos/indicadores.

## 2. Quién asiste / Notificados
- Notificados (función NOTIFICAR): lista fija de solo lectura en la ventana. El backend NO los recibe: los conserva tal cual al guardar.
- Quién asiste: opciones = usuarios con `Usuario.esInspectorCalidad` (endpoint `GET /api/calidad/solicitudes/inspectores`) + los ACUDIR ya asignados (se conservan aunque no tengan el permiso) + "Servicio Tercero". Nunca los notificados.
- Backend (`guardarCierreBorrador`): rechaza un notificado como asistente ("las listas no se mezclan"); los ACUDIR NUEVOS deben ser Inspector Calidad; usuarios activos con email (validarReferencias).
- Servicio Tercero: `SolicitudInspeccion.servicioTercero` (texto ≤200; obligatorio si se elige la opción). Se muestra en el detalle y en el PDF.
- Permiso de USUARIO `Usuario.esInspectorCalidad` (default false): casilla "Inspector Calidad" en Usuarios (crear/editar) + columna. Mismo patrón que `puedeEditarCierresAjenos`.
- Migración `20261110150000_inspector_calidad_servicio_tercero`.

## 3. Indicadores de madurez
- Etiqueta, placeholder y mensajes del cierre; validaciones del backend ("indicador de madurez N"); detalle; mantenedor (título, descripción, formulario, toasts, menú "Indicadores Madurez"); ItemMenu `CONFIG_CARACTERISTICAS_MADUREZ` nombre → "Indicadores de Madurez" (UPDATE en la migración + seed). Códigos, rutas y nombres técnicos sin cambio.

## 4. Editar / Cerrar desde el listado (contexto Calidad)
- Menú de opciones: "Editar inspección" (abre la ventana) y "Cerrar inspección" (diálogo de confirmación; legacy sin líneas elige el resultado). Visibles con las mismas condiciones que el antiguo Cerrar (NOTIFICADA + TOTAL en cualquiera de los dos ítems, o asignado ACUDIR con LECTURA).
- `PUT /solicitudes/:id/cierre` (guardar): body `{ comentarios?, fechaHora?, acudeIds[], servicioTercero?, lineas?[{ solicitudLineaId, veredicto?|null, defectos, caracteristicas }], defectos?, caracteristicas? }`. Todo opcional/incompleto; valida defectos/indicadores contra la especie de la línea. Solo NOTIFICADA; ACUDIR o TOTAL. Sin correo. Escribe comentariosCierre, fechaHora, servicioTercero, asignados (ACUDIR + NOTIFICAR intactos), estadoCierre por línea (nullable), defectos y madurez (reemplazo completo) en una transacción con CAS sobre NOTIFICADA.
- `POST /solicitudes/:id/cerrar`: body `{ resultado? }` (solo legacy). Solo cambia el estado con lo guardado: exige comentarios, fecha de visita, ≥1 ACUDIR o Servicio Tercero, y veredicto en todas las líneas (rollup APROBADA/RECHAZADA/OBJETADA/MIXTO); si falta algo, 400 indicando qué completar en "Editar inspección". CAS NOTIFICADA → resultado, fechaCierre, cerradaPor; cancela recordatorio y envía el correo de cierre (comentarios guardados).
- Reabrir: sin cambios.

## 5. PDF Solicitud de Inspección v3
- Plantilla nueva v3 (v1/v2 congeladas), `plantillaActual: 'v3'`.
- Resultado por línea: una tabla por línea, título "Resultado · Especie · Variedad · Embalaje — Veredicto"; filas uno por defecto (Tipo Defecto · Grupo · Descripción · Valor) y uno por indicador de madurez. Sin datos: "Sin defectos ni mediciones".
- Asignados incluye "Servicio Tercero: {nombre}".
- Payload: `lineas[].defectosDetalle?`, `lineas[].madurezDetalle?`, `servicioTercero?` (opcionales; v1/v2 los ignoran).

## Verificación hecha por Claude
- tsc fas-api y fas-web OK; ESLint de los features tocados sin errores.
- Migración aplicada en fas_test; consultas nuevas ejecutadas en runtime contra fas_test sin error de Prisma.
- Los tests de integración existentes de `POST /cerrar` con el body completo quedan obsoletos por el nuevo contrato (decisión del usuario: cerrar solo cambia el estado) — los actualiza Codex en la fase de tests.

## Ronda 2 — decisiones del usuario sobre QA ronda 1
- CIG-001 (Alta) — CORREGIR (aprobado): `cerrarConValidacion` hace en UNA transacción `SELECT … FOR UPDATE` de la solicitud (tenant + no eliminada), relee el detalle, revalida estado/permiso/completitud (`resultadoCierre`) y aplica el CAS NOTIFICADA → resultado. Guardar escribe la misma fila en su transacción → ambas se serializan. Se eliminó `marcarCerrada`.
- CIG-002 (Media) — ACEPTADO sin cambio (usuario: "No te preocupes por las antiguas, no hay data válida"): las solicitudes legacy sin líneas no se ajustan.
- CIG-003 (Media) — CORREGIR (aprobado, texto del usuario): label público del mantenedor en `config.routes.ts` = "Indicadores de Madurez".
- CIG-003 (ronda 2): botón del mantenedor "Nueva Característica" → "Nuevo Indicador" (misma corrección aprobada).
