# Plan — Cierre Comercial: reorden del formulario + Calidad/Condición por línea (2026-11-09)

## Pedido del usuario
1. Menú: Ventas antes que Compras (Gestión Comercial).
2. Encabezado del Cierre (3 columnas):
   - F1 Fecha · Tipo de venta · Contrato naviero
   - F2 Exportador (2 col) · Responsable
   - F3 Cliente · Dirección (2 col) — se elimina Detalle de Dirección
   - F4 Comprador · Consignatario · Notify
   - F5 Tipo de embarque · País · Mercado
   - F6 Puerto destino · Tipo de flete · Tipo de BL
   - F7 Incoterm · Modalidad de venta · Condición de pago
   - F8 Forma de pago · Moneda
   - Se elimina Temporada del form (se usa la variable general).
3. Detalle de línea:
   - F1 igual (Especie, Variedad, Categoría)
   - F2 Artículo (2 col) · Etiqueta
   - F3 Calibre inicio · Calibre fin · Agregar · Calibres en PDF
   - F4 Calidad hasta · Condición hasta
   - F5 Tipo pallet · Cant. pallets · Cajas
   - F6 Valor por caja · Fecha compromiso
4. Calidad / Condición "hasta" pasan del encabezado a cada línea.

## Decisiones del usuario (2026-11-09)
- Migración: los Cierres existentes copian la Calidad/Condición del encabezado a todas sus líneas.
- Embarque: un pallet se ofrece/reserva si calza con una línea Y cumple la Calidad/Condición de ESA línea.
- Detalle de Dirección: deja de usarse por completo (form, PDF nuevo y payload AGL360); la columna queda en BD.

## Implementación
- Migración `20261109180000_cierre_calidad_por_linea` (add columnas en notas_venta_detalle, backfill desde encabezado, drop columnas del encabezado).
- API notas-venta: schema/types/repo/service — campos en detalle; validación tenant al agregar/editar (solo si cambia)/duplicar; duplicar copia por línea.
- Embarques: `palletCalzaConDetalleNV(lineas, detalleNV, notas?)` + `lineaAdmiteNotas`; `getPalletsDisponibles(detalle)`; `reservarPalletsEnEmbarque(ids, embarqueId, detalle)` relee pallets en tx y condiciona el claim a las notas leídas. Se quita `direccionRetiro` del payload AGL360.
- Proforma (sugerencia de precio): prefiere la línea del Cierre que admite las notas del pallet.
- PDF: `cierre-comercial/v4` (columna Calidad/Condición en tabla); `plantillaActual = v4`; v1–v3 sin cambios (reciben el valor común de las líneas).
- Web: nav-config, form reordenado, tabla de líneas con columna Calidad/Cond., tipos.
- Docs/ventas.md: nota de supersesión.

## Riesgos
- Embarques con pallets ya reservados no se tocan (no retroactivo).
- Plantillas v1–v3 congeladas: el campo de encabezado ahora se deriva (valor común o null).
