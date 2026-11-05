# Plan — Batch Cierre Comercial (nov-2026)

## Contexto
Ajustes del cliente sobre el Cierre Comercial (`NotaVenta`) y sus maestros: Usuarios, Artículos, Contactos y Países.
Estado actual (explorado 2026-11-05):
- `NotaVenta` (schema :3188) ya tiene `compradorContactoId` (EntidadContacto), `notifyId` y `consignatarioId` (Entidad), `mercadoId` + `paisDestinoId`. No tiene responsable de venta.
- Calidad/Condición: pares explícitos en `NotaVentaCalidadPermitida` (commit 55022c4, 2026-10-23). Antes eran dos listas independientes. `NotaCalidad`/`NotaCondicion` no tienen `orden`.
- Calibres por línea: N:M `NotaVentaDetalleCalibre`. El rango Desde/Hasta del form solo agrega a la lista.
- `Usuario`: `esResponsableVenta` y avatar (`UsuarioAvatar`, Bytes) ya existen. No hay firma.
- `Articulo`: `descripcion` + `descripcionExtranjera` (ya usada en Proforma/Factura Export/OC EN). No hay descripción comercial.
- `EntidadContacto.tipo` es texto libre. No hay vínculo Cliente→Notify/Consignatario.
- PDF `cierre-comercial` (resolver `documentos/resolvers/cierre-comercial.resolver.ts`, template `templates/cierre-comercial/v1/index.tsx`).

---

## 1. Duplicar Cierre completo
- **API:** `POST /api/ventas/notas-venta/:id/duplicar` (VENTAS_NV, TOTAL).
  - service → repo `duplicarNotaVenta` en `$transaction`, con el mismo advisory lock + folio max+1 que `createNotaVenta` (repo :282-309).
- **Se copia:**
  - el encabezado completo (cliente, exportador, comprador, notify, consignatario, destino, parámetros, condición de pago, moneda, observaciones, contrato naviero, calidad/condición);
  - las líneas con sus calibres y modo de calibre.
- **No se copia:**
  - folio y fecha (hoy);
  - estado de cierre (`cerradoEn` null);
  - Embarques y vínculos con OC.
- **Cuotas:** se re-snapshotean desde `condicionPagoId` vigente y se recalcula `MONTO_UNITARIO` con las líneas copiadas.
- **Responsable de venta:** queda el usuario que duplica (regla "digitador").
- **Web:** acción "Duplicar" en `nota-venta-columns.tsx` y botón en el detalle. Confirma y navega al nuevo Cierre.

## 2. Notify / Consignatario / Comprador por defecto desde la ficha del Cliente
*(confirmado 2026-11-05: contacto con categoría + vínculo a Entidad)*
- **Recomendado:** `EntidadContacto` gana `categorias CategoriaContacto[]` (`COMPRADOR | NOTIFY | CONSIGNATARIO`) y `entidadVinculadaId Int?` (FK compuesta a Entidad).
  - Un contacto NOTIFY/CONSIGNATARIO del Cliente apunta a la Entidad Notify/Consignatario real, que es la que tiene TAXID y dirección para Instructivo/Proforma/DTE.
  - Se valida que la Entidad tenga el `TipoEntidad` correspondiente.
- **Ficha Entidad** (`entidad-form.tsx`, ContactoDialog :303-460):
  - multiselect de categoría;
  - si es Notify/Consignatario, Combobox de entidad (con quick-create, patrón QuickCreate);
  - flag `porDefecto` por categoría (un solo default por cliente y categoría, con índice único parcial).
- **Cierre:** al elegir Cliente se autocompletan Comprador, Notify y Consignatario con los defaults (solo si están vacíos o vienen del default anterior).
  - Los combos muestran primero las vinculadas al cliente ("del cliente") y luego el resto.
  - Se agrega validación de `TipoEntidad NOTIFY` en el service; hoy no se valida.

## 3. Calidad y Condición por separado con regla "hasta"
- **Maestros:** `NotaCalidad.orden Int` y `NotaCondicion.orden Int`.
  - Se agregan al mantenedor (form + columna + carga masiva).
  - Backfill por orden de `codigo` (A<B<C, 1<2<3).
- **NotaVenta:** `notaCalidadHastaId Int?` y `notaCondicionHastaId Int?` (null = sin restricción).
  - Regla: un pallet califica si `calidad.orden <= hasta.orden` **y** `condicion.orden <= hasta.orden`.
  - Ejemplo: Calidad B admite A y B; Condición 3 admite 1, 2 y 3.
- **Migración:** desde los pares existentes se toma la calidad de mayor orden y la condición de mayor orden. Después se elimina `NotaVentaCalidadPermitida`.
- **Enforcement:** `embarques.repository.getPalletsDisponibles` (:290-313) pasa del set de pares a una comparación por orden.
  - **Además** se agrega el chequeo en `reservarPalletsEnEmbarque` (:322). Hoy la calidad permitida solo filtra el listado y no se re-valida al reservar.
- **Web:** dos Selects ("Calidad hasta" y "Condición hasta", con opción "Sin restricción") reemplazan `CalidadesPermitidasInput` en el Cierre.
- **PDF:** mostrar "Calidad: hasta B · Condición: hasta 3".
- **Alcance (confirmado):** solo el Cierre. Instructivo de Embalaje y Solicitud de Inspección mantienen los pares.
  - No se elimina el helper `shared/calidades-permitidas.ts`.

## 4. Mercado derivado del País + buscador
- **Form Cierre:** el **País destino va primero**, como `Combobox` con búsqueda sobre los países que pertenecen a algún Mercado de la empresa. `listPaises` ya expone `mercadoIds`.
  - Si el país pertenece a 1 mercado, se asigna automáticamente y queda de solo lectura.
  - Si pertenece a más de uno, Select acotado a esos mercados.
  - Si pertenece a ninguno, no aparece en la lista.
  - Al cambiar el país se limpia el puerto.
- El backend no cambia: `paisPerteneceAMercado` (service :95) sigue validando.
- **Buscador en los demás selectores de País** (swap directo Select→Combobox):
  - `entidad-form.tsx:180,944`
  - `empresa-form.tsx:162`
  - `puerto-form-sheet.tsx:166`

## 5. Volver a "Por definir"
- `components/ui/combobox.tsx`: prop opcional `noneLabel` que agrega un ítem al tope y hace `onChange(null)`.
- En el Cierre se aplica a:
  - **Dirección** (:665), **Puerto destino** (:776) y **Categoría** de la línea (:925): ítem "Sin definir" (hoy Radix no permite limpiar);
  - **Cliente:** "Cliente Sin Definir" (`CLIENTE-SD`) queda siempre fijo como primera opción del Combobox;
  - Notify, Consignatario y Exportador migran a `noneLabel`;
  - se unifica el sentinel `'none'`/`'__none__'` en un helper compartido.
- Mercado, País, Tipo Embarque y Moneda siguen siendo obligatorios (regla de negocio).

## 6. Responsable de Venta
- **Schema:** `NotaVenta.responsableVentaId String?` (FK a Usuario; el boundary de FKs a Usuario es String). Mismo patrón que `OrdenCompra.responsableId`.
  - Backfill: `responsableVentaId = creadoPor`.
- **Default:** el usuario digitador.
- **Lista:** usuarios con `esResponsableVenta`, más el digitador si no lo es.
  - Reutilizar la query de responsables de OC (`ordenes-compra.repository.ts:706`), extraída a un endpoint compartido de usuarios.
- **Service:** valida que el usuario elegido sea responsable de venta, o que sea el creador.
- Se agrega a `CAMPOS_HEREDADOS_R4`: no es heredado y no se bloquea post-Embarque. Solo se confirma.

## 7. Firma del usuario (PNG transparente)
- `UsuarioFirma` (clon de `UsuarioAvatar`): `usuarioId @id`, mime, tamano, `datos Bytes`.
  - Endpoints `POST|GET|DELETE /api/config/usuarios/:id/firma`.
  - Solo `image/png`, máximo 1 MB. Se valida la firma PNG por magic bytes y que tenga canal alfa (color type 4/6).
- **Web:** `firma-upload-field.tsx` (copia de `avatar-upload-field.tsx`), visible cuando `esResponsableVenta`, con preview sobre fondo cuadriculado.
- **Imagen de usuario:** el avatar ya existe pero solo se muestra en edición (`usuario-form.tsx:257`). Se habilita también en creación (subida después del POST, como los contactos en `entidad-form`).
- **PDF:** helper `firmaDataUri(usuarioId)` en `documentos.repository.ts`, mismo patrón que `logoDataUri`.

## 8. Artículo: Descripción comercial
- **Schema:** `Articulo.descripcionComercial String?`. En la UI, `descripcionExtranjera` se renombra "Descripción comercial (extranjera)".
- **Maestro:** form, listado y carga masiva de artículos.
- **Helper compartido** `descripcionArticuloComercial(a, idioma)`:
  - ES → `descripcionComercial ?? descripcion` (fallback para no romper datos actuales);
  - EN → `descripcionExtranjera` (sin cambios).
  - Integrar con `cobranza/descripcion-idioma.ts`.
- **Cambia a comercial** (fuera de materiales):
  - Cierre: repo, form :941/:1157, mensajes de error, PDF;
  - OC fruta;
  - Instructivo de Embalaje y de Embarque (form + PDF);
  - Proforma (líneas sugeridas `proforma.service.ts:109,127`);
  - Factura Nacional desde Embarque;
  - Embarques y stock de fruta;
  - Solicitudes de Inspección (form, email, PDF);
  - Contratos de Productor y Ficha;
  - Cajas por pallet;
  - labels de Combobox (`codigo — descripcion comercial`).
- **Se mantiene `descripcion`:** Movimientos, Kardex, Saldos/Stock materiales, Recetas, Proforma Material, OC Material, Factura Nacional desde Proforma Materiales, Guía DTE 52 de materiales.

## 9. PDF Cierre Comercial
- **Artículo:** descripción comercial.
- **Calibres:** nuevo `NotaVentaDetalle.calibreModo` (`ESPECIFICOS | RANGO`, default ESPECIFICOS), sin efecto funcional.
  - Toggle en el editor de línea.
  - Si es RANGO, el PDF muestra "Desde {menor} hasta {mayor}" según el orden de calibre. Si es ESPECIFICOS, la lista.
  - Se copia al duplicar.
- **Columnas que se eliminan:** Kg Bruto Envase (unitario bruto), Kg Neto, Kg Bruto, y los totales de kilos (tabla + `BloqueTotales`).
  - Queda Kg Neto Envase.
  - Se ajustan el schema `cierre-comercial.schema.ts` y el resolver :28-39, :62-71.
- **Cuotas:** se elimina el bloque (template :99-107, resolver :100-107). La forma de pago sigue mostrándose como texto.
- **Encabezado:** "Responsable de Venta: {nombre}".
- **Firma:** en `PieFirma`, lado "Frutera Agrosan", va la imagen PNG de firma del responsable sobre la línea, con el nombre debajo. Si no tiene firma, queda la línea vacía.
  - `PieFirma` gana una prop opcional `imagen` por firmante, reutilizable en otros PDFs.
- **Bugs vistos de paso (confirmado corregir):**
  - la Etiqueta sale de `articulo.etiqueta` en vez de la de la línea (`l.etiqueta`);
  - el Exportador siempre es `empresa` y no `nv.exportador`.

---

## Orden de implementación
1. Migración única de schema:
   - `orden` en NotaCalidad/NotaCondicion;
   - NotaVenta: hasta + responsable;
   - `calibreModo`;
   - `UsuarioFirma`;
   - `Articulo.descripcionComercial`;
   - `EntidadContacto.categorias` + vínculo.
   - Backfills + drop de `NotaVentaCalidadPermitida`.
   - Agregar los nuevos modelos tenant a `MODELOS_TENANT` si aplica.
2. Backend Cierre (§3, §5, §6, §1) + enforcement Embarque.
3. Usuarios (firma) y Artículos (comercial + helper + barrido de módulos).
4. Contactos/defaults (§2) y País/Mercado (§4).
5. PDF (§9).
6. Tests de integración (duplicar, hasta, responsable, reservar con calidad fuera de rango) → ciclo QA Codex.
7. Coolify: migración + backfill de `orden` (revisar códigos reales de Agrosan/AGDry antes).
