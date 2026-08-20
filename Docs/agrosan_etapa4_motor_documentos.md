# Etapa 4 — Motor de Documentos

**Sistema Integral Frutera Agrosan**
VIAIN Asesorías Informáticas · Agosto 2026 · Versión 0.1 — Propuesta para revisión · Confidencial

---

Un solo motor que genera todos los PDF de la operación — desde la orden de compra hasta la liquidación al productor — con preview HTML fiel y plantillas que cualquiera del equipo pueda mantener.

> **⚠️ Reconciliación con el stack real de FAS (2026-08-18, decisión de Christian, ver CLAUDE.md §11 #12/#13).** Este documento es la propuesta original (v0.1) tal como se recibió. Se adopta el **principio y la arquitectura de documento** (preview=PDF, registro central, snapshot del payload, componentes React compartidos, `print.css` con tokens, Paged.js por documento) pero se **adapta la infraestructura** a lo que FAS ya tiene construido, no a lo que el doc asume:
> - **"api (NestJS)"** (§4) se lee como genérico — la API real es **Fastify** (`fas-api`, ya construida con ese stack). No hay reescritura a NestJS.
> - **`docs-service` en contenedor aparte** (§4, §12) queda diferido — el motor vive **dentro de `fas-api`**, módulo `modules/documentos/` (mismo patrón repository/service/controller/routes que el resto de módulos). Se separa a su propio contenedor si Chromium da problemas reales de memoria/estabilidad bajo el volumen actual de un solo VPS — no antes.
> - **Playwright confirma sobre Puppeteer** (§3) — VPS de Coolify es x86_64, así que la ventaja ARM64 no aplicaba, pero la diferencia de velocidad en caliente sí (ver comparativa §3). Con nada construido todavía, el cambio no tuvo costo de migración.
> - **Sin monorepo `apps/`/`packages/`** (§12) — FAS son 2 repos (`fas-api`/`fas-web`), no un monorepo con tooling de workspaces. El motor, la UI compartida (`docs-ui` del doc) y las plantillas viven todas dentro de `fas-api/src/modules/documentos/` (`ui/`, `resolvers/`, `schemas/`, `templates/`).
> - **Sin S3/MinIO** (§4) — `documentos_emitidos.pdf` se guarda como `Bytes` en Postgres, mismo patrón que los adjuntos de Recepción y Solicitud de Inspección que ya existen en FAS. Se reconsidera si el volumen de PDF crece mucho.
> - **Paged.js, PDF/A, regresión visual en CI, cola BullMQ para lotes** (§6, §8) quedan diferidos a cuando exista el primer documento multipágina real (Sprint B del propio doc, liquidaciones) — el piloto de Sprint A (Orden de Compra) es de una página.
>
> **Adenda (2026-08-18, mismo día — ciclo "Instructivo/Solicitud/Cierre Comercial PDF", QA Codex FAS-DOC-R1-001/AMB-001/AMB-002):**
> - Se agregan al registro (`documentos.registry.ts`) tres documentos fuera del catálogo original de §2, decisión de Christian:
>   - **Instructivo de Embalaje** (`compras.md` §4.1) y **Solicitud de Inspección** — ambos con la misma dinámica de preview/descarga que la OC, pero **sin control de copia**: no tienen versión "oficial" distinta del borrador, no se emiten ni se reimprimen, y su preview/descarga **no llevan ninguna marca de agua** (`DocumentDefinition.controlCopia = false`, ver `documentos.types.ts`). La Solicitud de Inspección es un **snapshot del pedido de visita** (productor, fecha, alcance, asignados) — no el informe de resultados por caja de `calidad.md` §3-§4, que sigue sin construir.
>   - **Cierre Comercial** (modelo `NotaVenta`, tipo de registro `cierre-comercial`) — mismo tratamiento que la OC, **con** control de copia completo (BORRADOR/Emitir/COPIA).
> - El piloto de Sprint A dejó de ser "de una página": Instructivo y Cierre Comercial pueden tener tantas líneas de detalle como el usuario cargue. El preview (`DocumentoPreviewDialog`) sigue sin paginación editorial real (Paged.js, todavía diferido a Sprint B) — muestra el documento completo en una sola superficie desplazable, no hojas discretas con cortes/encabezados repetidos como hará el PDF en un documento largo. Se acotó el texto del visor para no prometer una equivalencia pixel-perfect que no existe todavía en ese escenario; la paginación real del preview queda pendiente para cuando se aborde Paged.js.
>
> **Adenda (2026-08-19, ronda de ajustes visuales — QA Codex FAS-DOC-IMP-R1-001, `documentos_emitidos` con 0 filas verificado en ese momento):** las plantillas `v1` de Orden de Compra y Cierre Comercial (calibres por descripción, columnas de Kg por envase, reordenamiento de Solicitud de Inspección/Cierre Comercial, tipografía de tabla) se siguen **editando en el mismo archivo `v1`**, sin crear `v2` — regla del §4/§9 de este doc ("las plantillas viejas nunca se editan, se versiona") todavía no aplica en la práctica porque no existe ningún documento realmente emitido cuya reimpresión pudiera verse afectada. **A partir de la primera emisión real** (primer `POST /documentos/orden-compra/:id/emitir` o `/documentos/cierre-comercial/:id/emitir` que efectivamente persista una fila en `documentos_emitidos`), cualquier cambio de contenido, layout o tipografía de tabla (`print-css.ts`, compartido entre plantillas) que afecte esos dos documentos debe ir a una versión nueva (`v2`, registrada junto a `v1` en `documentos.registry.ts`, con `plantillaActual` apuntando a la nueva) — no editarse en el archivo existente.
>
> El resto del documento (catálogo §2, anatomía de plantilla §5, sistema de diseño §6, plan de sprints §9) sigue siendo la referencia de diseño válida.

| | |
|---|---|
| Documentos en alcance | **18** |
| Motores de render | **1** |
| Sprints | **4** |
| Divergencia preview / PDF | **0** |

---

## 1. Principio: el preview *es* el PDF

Casi todos los sistemas de documentos fallan por la misma razón: el preview en pantalla y el PDF final se generan por caminos distintos, y con el tiempo divergen. Lo que Lorenzo aprueba en pantalla no es lo que le llega al productor. Esta etapa se construye sobre la regla contraria.

> **Regla fundacional**
>
> Cada documento se define **una sola vez** como una plantilla HTML+CSS. La misma URL, con el mismo payload, produce el HTML que se ve en pantalla y el PDF que se descarga. El PDF no es una reimplementación del preview: es **una foto del preview** tomada por un navegador headless. Si el preview cambia, el PDF cambió. Es imposible que difieran.

Consecuencias directas:

- **Mantención barata.** Cambiar el logo, un texto legal o una columna de la liquidación es editar HTML y CSS. No requiere tocar código de generación de PDF ni conocer una API de dibujo.
- **Estética sin techo.** Grid, flexbox, tipografía real, tablas con encabezados repetidos, gráficos SVG, fotos de calidad. Todo lo que se puede hacer en la web se puede imprimir.
- **Una sola marca.** Los tokens de color, tipografía y espaciado salen del mismo archivo que usa la aplicación web. La identidad de Agrosan es consistente en pantalla y en papel.
- **Reimpresión fiel.** Una liquidación emitida en 2026 y reimpresa en 2029 se ve exactamente igual, aunque la plantilla haya cambiado tres veces y los precios de la base sean otros.

---

## 2. Catálogo de documentos

Todo el flujo core, agrupado por área y con su key user responsable de aprobar el diseño. El formato de página se decide por documento, no globalmente — un packing list de embarque no cabe en A4 vertical y una etiqueta de pallet no es una hoja.

### 🛒 Compras — *Marcos*

| Documento | Descripción | Formato | Estado |
|---|---|---|---|
| **Orden de Compra** | Productor, variedades, kilos comprometidos, condiciones de pago, espacio de firma. | A4 vertical | Clave |
| **Contrato / Acuerdo de temporada** | Documento largo con cláusulas, anexo de precios y firma de ambas partes. | A4 vertical | Pendiente |

### 🚢 Ventas — *Giovanni*

| Documento | Descripción | Formato | Estado |
|---|---|---|---|
| **Nota de Venta / Sales Contract** | Bilingüe ES/EN, moneda USD, incoterm, condiciones de embarque. | A4 vertical | Clave |
| **Proforma Invoice** | Exportación, inglés, para trámite aduanero y apertura de carta de crédito. | A4 vertical | Pendiente |
| **Packing List de embarque** | Detalle por pallet, lote, variedad, calibre, cajas y peso. Tabla larga multipágina. | A4 horizontal | Clave |

### 📦 Operaciones — *Bernardo*

| Documento | Descripción | Formato | Estado |
|---|---|---|---|
| **Guía de recepción de fruta** | Recepción en planta: productor, lote, bins, peso bruto/neto, hora, responsable. | A4 vertical | Pendiente |
| **Etiqueta de lote / rótulo de pallet** | Formato térmico con código de barras o QR de trazabilidad. No es una hoja carta. | 100 × 150 mm | Nuevo |
| **Orden de despacho / picking** | Instrucción de armado de carga para bodega, con checkboxes de verificación. | A4 vertical | Pendiente |
| **Vale de salida de materiales** | Consumo de cajas, bolsas e insumos por lote, con cargo al productor. | A4 vertical | Pendiente |

### 💰 Finanzas — *Fabián · María José*

| Documento | Descripción | Formato | Estado |
|---|---|---|---|
| **Estado de cuenta / Cartola de productor** | Anticipos, cargos, liquidaciones y saldo. Documento de conversación con el productor. | A4 vertical | Clave |
| **Estado de cuenta de cliente** | Cuentas por cobrar, aging de facturas, para gestión de cobranza. | A4 vertical | Pendiente |
| **Comprobante de pago / Egreso** | Respaldo de transferencia a productor o proveedor, con detalle de documentos saldados. | A4 vertical | Pendiente |
| **Factura · Nota de crédito · Guía de despacho** | Documentos tributarios electrónicos. **Fuera del motor** — ver sección 7. | Proveedor DTE | Legal |

### 🧮 Liquidaciones — *Lorenzo · Patricia*

| Documento | Descripción | Formato | Estado |
|---|---|---|---|
| **Liquidación a Productor** | El documento estrella. Retorno bruto por variedad y calibre, matriz de costos, deducciones, anticipos, retorno neto. Multipágina con subtotales que no pueden partirse. | A4 horizontal | Clave |
| **Liquidación de anticipos** | Adelantos entregados durante la temporada, con su imputación futura. | A4 vertical | Pendiente |
| **Resumen de temporada por productor** | Consolidado anual: kilos, embarques, retorno promedio, comparativo con temporada previa. Incluye gráficos. | A4 vertical | Nuevo |

### ✅ Control de calidad — *Isella*

| Documento | Descripción | Formato | Estado |
|---|---|---|---|
| **Informe de inspección / validación de lote** | Parámetros medidos, tolerancias, veredicto. Con fotografías del lote. | A4 vertical | Nuevo |
| **Informe de reclamo / Claim Report** | Bilingüe ES/EN. Se envía al cliente en destino. Fotos, evidencia, cuantificación del daño. | A4 vertical | Nuevo |

### 📊 Gerencia — *Lorenzo*

| Documento | Descripción | Formato | Estado |
|---|---|---|---|
| **Informe de cierre de embarque** | Resultado consolidado de un embarque: costos, retorno, margen, desviaciones. | A4 vertical | Pendiente |
| **Reporte de temporada** | Documento ejecutivo con gráficos, para directorio y bancos. | A4 vertical | Nuevo |

---

## 3. Elección del motor de render

Se evaluaron cuatro caminos. El criterio no fue solo velocidad: pesó más la capacidad de que una persona que sabe CSS pueda mantener las plantillas sin aprender una tecnología nueva.

### ✅ Recomendado — Playwright + Chromium headless

Un navegador real renderiza la plantilla y exporta a PDF con `page.pdf()`. Se mantiene un pool de instancias calientes para evitar el arranque en frío.

- ✓ CSS completo: Grid, Flexbox, custom properties, `@page`, web fonts.
- ✓ Ejecuta JavaScript — habilita Paged.js, gráficos y códigos de barras en cliente.
- ✓ Con pool caliente: ~3 ms documento simple, ~13 ms complejo. En frío, 42 / 119 ms.
- ✓ Binarios nativos ARM64 en Linux — corre en VPS Graviton o Apple Silicon sin trucos.
- ⚠ Imagen Docker de 300–500 MB. Se resuelve aislándolo en su propio contenedor.

### ❌ Descartado — Puppeteer

El clásico. Misma idea que Playwright pero con una API más antigua y peor comportamiento operacional.

- ✗ Sin binario nativo de Chrome para ARM64 Linux — fricción real de despliegue.
- ✗ Más lento: 48 / 58 ms en caliente frente a 3 / 13 ms de Playwright.
- ✗ Ganancia menor del pool caliente (3× vs 9–14×).
- ✓ Mismo modelo mental — migrar después es trivial si hiciera falta.

### ❌ Descartado — WeasyPrint

Motor Python de CSS Paged Media. Excelente paginación editorial y PDFs muy livianos.

- ✓ Archivos 2–5× más pequeños (8 KB vs 16 KB en documento simple).
- ✗ No ejecuta JavaScript: sin gráficos dinámicos, sin códigos de barras generados en cliente.
- ✗ Vacíos en CSS moderno — hay que escribir el CSS "para WeasyPrint", no CSS normal.
- ✗ Es Python. Suma un runtime más al stack Node/TypeScript del proyecto.
- ✗ Sin modo caliente: 227 ms simple, 629 ms complejo.

### ❌ Descartado — pdfmake / React-PDF

El PDF se describe en código o JSON, sin HTML intermedio. Determinista y liviano.

- ✓ Sin navegador: contenedor pequeño, arranque instantáneo.
- ✗ No hay preview HTML fiel — se rompe el principio fundacional de esta etapa.
- ✗ Cambiar el diseño exige programar, no maquetar. Mantención cara.
- ✗ Techo estético bajo: sin Grid real, control tipográfico pobre, tablas rígidas.

### Comparativa

| Criterio | Playwright | Puppeteer | WeasyPrint | pdfmake |
|---|---|---|---|---|
| Render caliente (simple / complejo) | **3 / 13 ms** | 48 / 58 ms | 227 / 629 ms | ~20 ms |
| Render en frío | 42 / 119 ms | 147 / 187 ms | 227 / 629 ms | **~20 ms** |
| Preview HTML idéntico | **Sí** | **Sí** | Parcial | No |
| CSS moderno completo | **Sí** | **Sí** | Parcial | No |
| Ejecuta JavaScript | **Sí** | **Sí** | No | No |
| ARM64 Linux nativo | **Sí** | No | **Sí** | **Sí** |
| Runtime adicional al stack | **No** | **No** | Python | **No** |
| Costo de mantener una plantilla | **Bajo (CSS)** | **Bajo (CSS)** | Medio | Alto (código) |

*Cifras de referencia del benchmark HTML-to-PDF 2026 de PDF4.dev. Los tiempos son del motor de render aislado, sin contar consulta a base de datos ni transferencia.*

---

## 4. Arquitectura del servicio

El motor vive en su propio contenedor, separado de la API. La razón es operacional: Chromium pesa medio giga y se cae solo de vez en cuando. Aislarlo evita que un pico de generación de liquidaciones de fin de temporada tumbe el ERP completo, y permite escalarlo por separado.

### Flujo de generación

```
1. Resolver  →  2. Snapshot  →  3. Plantilla  →  4. Paginación  →  5. Render
```

1. **Resolver** — Consulta la base y arma un `payload` tipado con Zod. Nada de lógica de presentación.
2. **Snapshot** — Al emitir, el payload se congela en `documento_emitido` como JSONB.
3. **Plantilla** — Componente React tipado renderiza el payload a HTML estático + CSS de impresión.
4. **Paginación** — Paged.js corta en páginas reales, repite encabezados y numera «X de Y».
5. **Render** — Playwright fotografía el resultado. El PDF va a S3 con hash de contenido.

### Componentes

| Componente | Responsabilidad |
|---|---|
| **docs-service** | Contenedor con Chromium, el pool de Playwright y las plantillas compiladas. Expone `POST /render`. No habla con Postgres — recibe el payload ya resuelto. |
| **api (NestJS)** | Contiene los resolvers, el registro de documentos, permisos y la persistencia. Llama a `docs-service` por HTTP interno. Se mantiene liviana. |
| **Cola BullMQ** | Redis ya está en el stack. Render bajo demanda es síncrono con timeout de 10 s; los lotes (400 liquidaciones de cierre) van a la cola con notificación al terminar. |
| **S3 / MinIO** | Clave `documentos/{tipo}/{año}/{id}/{sha256}.pdf`. El hash da idempotencia: re-renderizar el mismo payload no duplica archivos. |

### Registro central de documentos

Un solo lugar donde se declara todo.

```ts
// packages/docs/src/registry.ts
export const DOCUMENT_REGISTRY = {
  'liquidacion-productor': {
    titulo:        'Liquidación a Productor',
    resolver:      resolverLiquidacionProductor,
    schema:        LiquidacionProductorPayload,   // Zod
    plantillaActual: 'v2',
    plantillas:    { v1: LiquidacionV1, v2: LiquidacionV2 },
    pagina:        { formato: 'A4', orientacion: 'landscape', margen: '14mm 12mm 18mm' },
    paginado:      'pagedjs',                     // 'pagedjs' | 'simple'
    permiso:       'liquidaciones:emitir',
    nombreArchivo: (p) => `Liquidacion_${p.productor.rut}_${p.folio}.pdf`,
    retencion:     'permanente',
  },
  'orden-compra': { /* ... */ },
  'packing-list':  { /* ... */ },
} satisfies Record<string, DocumentDefinition>;
```

### Endpoints — una URL, dos formatos

```
// Preview en pantalla: se muestra en un iframe dentro del ERP.
// El usuario ve páginas A4 reales antes de emitir.
GET  /documentos/liquidacion-productor/:id/preview

// PDF: Playwright abre exactamente la URL de arriba y la fotografía.
GET  /documentos/liquidacion-productor/:id.pdf

// Emisión: congela el payload, renderiza, guarda en S3, registra el folio.
POST /documentos/liquidacion-productor/:id/emitir

// Reimpresión: renderiza el payload congelado con SU versión de plantilla.
GET  /documentos/emitidos/:documentoEmitidoId.pdf

// Lote: encola N documentos, devuelve un jobId.
POST /documentos/lote
```

> **Por qué el snapshot del payload no es opcional**
>
> Si la reimpresión vuelve a consultar la base, un documento emitido en marzo cambia cuando alguien corrige un costo en abril. Para una liquidación a productor eso es inaceptable: es el documento en que se basa un pago. Al emitir, el payload completo se guarda en JSONB junto con la versión de plantilla usada, y la reimpresión renderiza *ese* payload con *esa* plantilla. Las plantillas antiguas nunca se editan — se crea `v2` y las emisiones nuevas la usan.

---

## 5. Anatomía de una plantilla

Las plantillas son componentes React en TypeScript, no strings de Handlebars. La diferencia importa: el compilador avisa si el payload no calza con lo que la plantilla espera, y los bloques comunes — encabezado, tabla de lotes, bloque de totales, pie con firma — se reutilizan entre los 18 documentos.

```tsx
// templates/liquidacion-productor/v2/index.tsx
import { Documento, Encabezado, TablaLotes, BloqueTotales, PieFirma } from '@agrosan/docs-ui';
import { fmt } from '@agrosan/docs-ui/formato';   // es-CL, único lugar donde se formatea

export function LiquidacionV2({ d }: { d: LiquidacionProductorPayload }) {
  return (
    <Documento titulo="Liquidación a Productor" folio={d.folio}>

      <Encabezado
        emisor={d.empresa}
        receptor={{ nombre: d.productor.nombre, rut: fmt.rut(d.productor.rut) }}
        fecha={fmt.fecha(d.fechaEmision)}
        temporada={d.temporada}
      />

      {/* Encabezado de tabla se repite en cada página; los grupos no se parten */}
      <TablaLotes
        lotes={d.lotes}
        agruparPor="variedad"
        columnas={[
          { k: 'lote',    t: 'Lote' },
          { k: 'calibre', t: 'Calibre' },
          { k: 'cajas',   t: 'Cajas',         f: fmt.entero },
          { k: 'kilos',   t: 'Kilos',         f: fmt.kilos },
          { k: 'precio',  t: 'Precio USD/kg', f: fmt.usd },
          { k: 'bruto',   t: 'Retorno bruto', f: fmt.usd },
        ]}
      />

      <BloqueTotales
        lineas={[
          { etiqueta: 'Retorno bruto',     valor: d.totales.bruto },
          { etiqueta: 'Costos de proceso', valor: -d.totales.costos, detalle: d.matrizCostos },
          { etiqueta: 'Anticipos',         valor: -d.totales.anticipos },
        ]}
        neto={{ etiqueta: 'Retorno neto a productor', valor: d.totales.neto }}
      />

      <PieFirma nota={d.notaLegal} firmantes={[d.empresa.representante]} />
    </Documento>
  );
}
```

Por qué así:

- **Tipado extremo a extremo.** El schema Zod define el payload; el resolver debe producirlo y la plantilla lo consume. Un campo renombrado en la base rompe la compilación, no el PDF del cliente.
- **Componentes compartidos.** Ocho o nueve bloques (`Encabezado`, `TablaLotes`, `BloqueTotales`, `PieFirma`, `Sello`, `GridFotos`) cubren los 18 documentos. Un ajuste de marca se hace una vez.
- **Formato en un solo lugar.** Miles con punto, decimales con coma, CLP sin decimales, USD con dos, RUT con guion, fechas `dd-MM-aaaa`. Prohibido formatear a mano dentro de una plantilla.
- **El mismo React del ERP.** No hay lenguaje de plantillas nuevo que aprender. Quien mantiene la pantalla de liquidaciones puede mantener el PDF de liquidaciones.

---

## 6. Sistema de diseño de impresión

Tailwind queda fuera de las plantillas de impresión. No maneja `@page`, no piensa en milímetros y sus utilidades hacen ilegible el CSS tipográfico fino que un documento formal necesita. En su lugar: una hoja de estilos propia alimentada por los mismos tokens de marca que usa la aplicación web.

### Tokens

| Token | Valor |
|---|---|
| `--doc-tinta` | `#0D2245` |
| `--doc-acento` | `#1A4E8F` |
| `--doc-destacado` | `#D4A832` |
| `--doc-positivo` | `#1D6B3E` |
| `--doc-negativo` | `#C53A1F` |
| `--doc-zebra` | `#F5F3EE` |

### La base de los 18 documentos

```css
/* packages/docs-ui/print.css */

/* Fuentes embebidas en la imagen Docker. Jamás Google Fonts en runtime:
   si la red falla, el PDF sale con otra tipografía y otro salto de página. */
@font-face {
  font-family: 'Fraunces';
  src: url('/fonts/Fraunces.woff2') format('woff2');
  font-display: block;
}

@page {
  size: A4 landscape;
  margin: 14mm 12mm 18mm;

  @top-left     { content: string(doc-titulo); /* corre en todas las páginas */ }
  @top-right    { content: string(doc-folio); }
  @bottom-right { content: "Página " counter(page) " de " counter(pages); }
  @bottom-left  { content: "Frutera Agrosan · Documento generado electrónicamente"; }
}

@page :first { @top-left { content: none; } }  /* la portada no repite encabezado */

/* Reglas que evitan cortes feos — lo que separa un PDF bonito de uno amateur */
.doc-grupo        { break-inside: avoid; }
.doc-totales      { break-inside: avoid; break-before: auto; }
.doc-tabla thead  { display: table-header-group; }   /* repite cabecera por página */
.doc-tabla tfoot  { display: table-footer-group; }
h2, h3            { break-after: avoid; }            /* sin títulos huérfanos al pie */
p                 { orphans: 3; widows: 3; }
.doc-foto         { break-inside: avoid; }

/* Números tabulares: las columnas de kilos y dólares quedan alineadas */
.doc-num { font-variant-numeric: tabular-nums; text-align: right; }
```

Decisiones asociadas:

- **Sin Tailwind en impresión.** Los tokens salen de `tokens.ts`, que genera tanto las CSS custom properties de impresión como el `tailwind.config` de la app. Una sola fuente de verdad de marca, dos consumidores.
- **Milímetros, no píxeles.** Todo el layout de página en unidades físicas. Un margen en `px` se ve distinto según el DPI del render; en `mm` es el mismo papel siempre.
- **Fuentes empaquetadas.** Los WOFF2 viven en la imagen del contenedor. El render no toca la red: es más rápido, funciona sin internet y es determinista para el testing visual.
- **Preview con sombra de página.** En pantalla, cada página se muestra como una hoja blanca con sombra sobre fondo gris. El usuario ve dónde caen los cortes antes de emitir.

### Paginación editorial

Chromium solo no alcanza. Una liquidación de 14 páginas necesita encabezado repetido, «Página 3 de 14», subtotales que no se parten y la cabecera de tabla en cada hoja. Chromium implementa `counter(page)` pero **no** `counter(pages)`, y no soporta running headers. Paged.js cubre exactamente ese hueco.

| Necesidad | Chromium solo | Con Paged.js |
|---|---|---|
| Número de página | Sí — `counter(page)` | Sí |
| Total de páginas («de 14») | **No** — `counter(pages)` no funciona | Sí |
| Encabezado corriente con dato del documento | **No** — sin `string-set` | Sí |
| Cabecera de tabla repetida por página | Sí — `thead` | Sí |
| Encabezado / pie vía plantilla del navegador | Sí, pero con CSS aislado y limitado | Innecesario |
| Primera página distinta (`@page :first`) | Parcial | Sí |
| Costo por documento | 0 ms | +200–400 ms |

> **Paged.js se activa por documento, no siempre**
>
> El registro define `paginado: 'pagedjs' | 'simple'`. Documentos de una página con estructura fija — orden de compra, comprobante de pago, etiqueta de pallet — usan el modo simple y rinden en milisegundos. Los multipágina con tablas largas — liquidación, packing list, cartola, contrato — pagan los 300 ms extra a cambio de paginación real.
>
> El render espera el evento `pagedjs-rendered` antes de exportar. Sin esa espera se producen PDFs truncados de forma intermitente, y es un bug difícil de diagnosticar después.

```ts
// docs-service/src/render.ts — pool caliente y espera correcta
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
// El pool se levanta al arrancar el contenedor y se reutiliza:
// 3 ms por documento en caliente contra 42 ms en frío.

export async function render(url: string, def: DocumentDefinition) {
  const ctx  = await browser.newContext({ locale: 'es-CL', timezoneId: 'America/Santiago' });
  const page = await ctx.newPage();

  await page.goto(url, { waitUntil: 'networkidle' });

  if (def.paginado === 'pagedjs') {
    // Sin esto se generan PDFs truncados de forma intermitente.
    await page.waitForFunction(() => window.__PAGEDJS_LISTO__ === true, { timeout: 30_000 });
  }
  await page.evaluate(() => document.fonts.ready);

  const pdf = await page.pdf({
    format:            def.pagina.formato,
    landscape:         def.pagina.orientacion === 'landscape',
    printBackground:   true,
    preferCSSPageSize: true,   // manda el @page del CSS, no el argumento
  });

  await ctx.close();
  return pdf;
}
```

---

## 7. Documentos tributarios: fuera del motor

> ⚠️ **La factura no es un PDF de diseño libre**
>
> Factura, nota de crédito, nota de débito y guía de despacho son Documentos Tributarios Electrónicos regulados por el SII. Su representación impresa tiene formato normado — el timbre electrónico en código de barras PDF417, el folio autorizado por CAF, el recuadro con RUT y tipo de documento, los datos obligatorios del emisor y receptor. El SII mantiene esa especificación en el documento «Formato Documentos Tributarios Electrónicos», cuya versión vigente es la **2.5 de febrero de 2026**.
>
> Tratar la factura como una plantilla más del motor introduce un riesgo regulatorio desproporcionado frente al beneficio estético.

### ✅ Recomendado — el proveedor DTE emite y entrega el PDF

Agrosan integra un proveedor de facturación electrónica certificado. El ERP le envía el detalle, recibe de vuelta el XML timbrado y el PDF de la representación impresa, y solo lo almacena y lo vincula al embarque.

- ✓ El riesgo de cumplimiento queda en quien está certificado para asumirlo.
- ✓ Los cambios de formato del SII los absorbe el proveedor, no el proyecto.
- ✓ El motor de documentos se concentra en los 18 documentos donde la estética sí decide.
- ⚠ Menor control visual sobre la factura. Aceptable: nadie evalúa a Agrosan por el diseño de su factura.

### Solo si es indispensable — Agrosan genera la representación impresa

El motor produce el PDF de la factura a partir del XML timbrado que devuelve el proveedor, incrustando el timbre PDF417 como imagen.

- ✓ Control total del diseño y consistencia visual con el resto de los documentos.
- ✗ Obliga a seguir y validar el formato normado del SII en cada cambio de versión.
- ✗ El timbre PDF417 debe generarse con una librería específica y verificarse contra el validador del SII.
- ✗ Un error de formato es un problema tributario, no un problema de diseño.

> **Decisión pendiente para Fabián y Lorenzo**
>
> Antes de cerrar el alcance de la Etapa 4 hay que confirmar dos cosas: qué proveedor de facturación electrónica usa hoy Agrosan y si su API devuelve el PDF ya armado. Si lo devuelve, la ruta recomendada se cierra sola y el motor no toca DTE. Si solo devuelve el XML timbrado, hay que evaluar la segunda ruta con un presupuesto propio, separado del resto de la etapa.

---

## 8. Pruebas y operación

Un PDF que se rompe no da error: da un documento feo que igual se envía al productor. Por eso las pruebas de esta etapa son visuales, no funcionales.

- **Regresión visual en CI.** Cada documento tiene payloads de referencia. En cada PR, CI renderiza, convierte a PNG con `pdftoppm` y compara píxel a píxel contra el golden con `odiff`. Si el diff supera el umbral, el PR se bloquea con las imágenes adjuntas.
- **Payloads deterministas.** Los fixtures tienen fecha, folio y datos fijos. Nada de `new Date()` dentro de una plantilla — la fecha llega en el payload. Sin esto, el diff visual falla todos los días.
- **Mismo contenedor en CI.** Las pruebas corren en la imagen de `docs-service`. Fuentes idénticas, Chromium idéntico. Un golden generado en el Mac de un desarrollador y comparado en Linux nunca calza.
- **Observabilidad.** Métricas por tipo de documento: latencia p95, tasa de error, páginas generadas, tamaño de salida. Una liquidación que empieza a tardar 8 s suele significar que una consulta creció, no que Chromium se puso lento.
- **Marca de agua de estado.** Los documentos no emitidos salen con marca «BORRADOR» diagonal. Las reimpresiones llevan «COPIA» y la fecha de reimpresión. Evita que un preview circule como documento oficial.
- **Archivo de largo plazo.** Los documentos de retención permanente — liquidaciones, contratos — se convierten a PDF/A con Ghostscript al emitirse, para que sigan siendo legibles y verificables en diez años.

### Estructura de carpetas propuesta

```
packages/
  docs/                          # lógica: registro, resolvers, schemas Zod
    src/registry.ts
    src/resolvers/liquidacion-productor.ts
    src/schemas/liquidacion-productor.ts
  docs-ui/                       # presentación compartida
    src/componentes/{Documento,Encabezado,TablaLotes,BloqueTotales,PieFirma}.tsx
    src/formato.ts               # es-CL: montos, kilos, RUT, fechas
    src/print.css                # @page, saltos, tipografía
    src/tokens.ts                # fuente única de marca (la usa también la app)
    src/fonts/*.woff2
  docs-templates/
    liquidacion-productor/v1/index.tsx
    liquidacion-productor/v2/index.tsx    # las versiones antiguas NO se editan
    orden-compra/v1/index.tsx
    packing-list/v1/index.tsx
    ...

apps/
  api/                           # NestJS: endpoints, permisos, persistencia, cola
  docs-service/                  # contenedor con Chromium + pool Playwright
    Dockerfile                   # fuentes instaladas en la imagen

tests/
  visual/
    fixtures/liquidacion-productor.json
    golden/liquidacion-productor-p1.png
    golden/liquidacion-productor-p2.png
```

---

## 9. Plan de implementación

Cuatro sprints. El primero construye el motor completo con un documento simple de piloto; los siguientes solo agregan plantillas, que es trabajo lineal y predecible. El documento más difícil se ataca temprano, en el sprint B, no al final.

### Sprint A — Motor y fundaciones
*El único sprint con riesgo técnico real*

- Contenedor `docs-service` con Chromium, pool de Playwright y fuentes embebidas.
- Paquetes `docs` y `docs-ui`: registro, schemas Zod, tokens, `print.css`, helpers es-CL.
- Integración de Paged.js con espera correcta del evento de render.
- Componentes base: `Documento`, `Encabezado`, `TablaLotes`, `BloqueTotales`, `PieFirma`.
- Endpoints de preview, PDF y emisión; tabla `documento_emitido` con snapshot JSONB.
- Visor de preview en el ERP (iframe con páginas A4 y sombra).
- **Piloto: Orden de Compra.** Documento de una página, aprobado por Marcos.

### Sprint B — Liquidaciones
*El documento de mayor impacto, atacado temprano*

- Liquidación a Productor: A4 horizontal, agrupación por variedad, matriz de costos, deducciones, anticipos.
- Paginación real: cabecera repetida, «Página X de Y», subtotales que no se parten.
- Liquidación de anticipos y resumen de temporada por productor (con gráficos SVG).
- Marca de agua BORRADOR / COPIA y conversión a PDF/A al emitir.
- Regresión visual en CI con los tres documentos como golden.
- Validación con Lorenzo y Patricia contra liquidaciones reales de la temporada anterior.

### Sprint C — Ventas y operaciones
*Trabajo lineal sobre el motor ya probado*

- Nota de Venta / Sales Contract bilingüe y Proforma Invoice.
- Packing List de embarque en A4 horizontal, multipágina.
- Guía de recepción de fruta, orden de despacho y vale de salida de materiales.
- Etiqueta de lote en formato térmico 100 × 150 mm con QR de trazabilidad.
- Contrato / acuerdo de temporada, con índice y anexo de precios.

### Sprint D — Calidad, finanzas y endurecimiento
*Cierre de catálogo y puesta a punto operacional*

- Informes de inspección y de reclamo, con grillas de fotografías y versión bilingüe.
- Cartola de productor, estado de cuenta de cliente y comprobante de pago.
- Informe de cierre de embarque y reporte de temporada.
- Cola BullMQ para lotes de cierre de temporada, con notificación al terminar.
- Métricas, alertas y pruebas de carga (400 liquidaciones seguidas).
- Definición final de la ruta DTE con Fabián.

---

## 10. Riesgos y mitigaciones

| Nivel | Riesgo | Mitigación |
|---|---|---|
| **Alto** | **Ambigüedad regulatoria en los DTE.** Si se asume que el motor genera la factura y luego el formato del SII no calza, se pierde un sprint y se abre un riesgo tributario. | Confirmar con Fabián el proveedor DTE actual y su API antes de cerrar el alcance. Ruta por defecto: el motor no toca documentos tributarios. |
| **Alto** | **La liquidación a productor resulta más compleja que lo estimado.** Es el documento con más reglas de negocio, más columnas y más excepciones por productor. | Se aborda en el sprint B, no al final, y se valida contra liquidaciones reales de la temporada anterior antes de darlo por cerrado. |
| **Medio** | **Chromium consume memoria y se degrada con el uso.** Un pool de navegadores sin reciclaje termina agotando la RAM del VPS. | Contenedor aislado con límite de memoria, reciclaje de instancias cada N renders, healthcheck y reinicio automático. Aislarlo garantiza que una caída no afecta al ERP. |
| **Medio** | **PDFs truncados de forma intermitente.** Exportar antes de que Paged.js y las fuentes terminen de cargar produce documentos incompletos que aparecen una de cada cien veces. | Espera explícita del evento `pagedjs-rendered` y de `document.fonts.ready`; prueba de carga de 400 documentos seguidos en el sprint D. |
| **Medio** | **Deriva de diseño entre documentos.** Con 18 plantillas escritas en meses distintos, cada una termina con su propio criterio de márgenes y tipografía. | Componentes compartidos obligatorios y revisión de diseño en cada PR de plantilla nueva. Un documento no se aprueba si define estilos propios que ya existen en `docs-ui`. |
| **Bajo** | **Golden tests frágiles.** Comparación píxel a píxel entre entornos distintos falla por antialiasing o fuentes. | CI corre en la misma imagen Docker que producción, con umbral de tolerancia calibrado y payloads de fecha fija. |

---

## 11. Resumen de decisiones

| Tema | Decisión | Razón principal |
|---|---|---|
| Motor de render | **Playwright + Chromium headless** | CSS completo, pool caliente 9–14× más rápido, ARM64 nativo |
| Origen del PDF | Foto del mismo HTML del preview | Imposible que preview y PDF diverjan |
| Lenguaje de plantillas | React + TypeScript | Tipado extremo a extremo; el equipo ya lo domina |
| CSS de impresión | Hoja propia con tokens compartidos, sin Tailwind | Tailwind no maneja `@page`, mm ni control de saltos |
| Paginación | Paged.js, activable por documento | Chromium no soporta `counter(pages)` ni running headers |
| Despliegue | Contenedor `docs-service` aislado | Chromium no debe inflar ni tumbar la API |
| Reimpresión | Snapshot del payload + versión de plantilla | Un documento emitido no puede cambiar después |
| Lotes | Cola BullMQ sobre el Redis existente | Cierre de temporada genera cientos de documentos de golpe |
| Pruebas | Regresión visual píxel a píxel en CI | Un PDF roto no lanza error, solo se ve mal |
| Documentos tributarios | Fuera del motor, vía proveedor DTE | Formato normado por el SII; riesgo desproporcionado |

---

## 12. Qué se necesita para arrancar

- Confirmación del proveedor de facturación electrónica y de si su API entrega el PDF armado.
- Manual de marca de Frutera Agrosan: logo vectorial, colores oficiales, tipografía corporativa.
- Ejemplares reales de cada documento actual — sobre todo liquidaciones de la temporada pasada — para no perder información que hoy los productores esperan ver.
- Definición del texto legal de pie para liquidaciones y órdenes de compra.

---

## Fuentes

- [HTML to PDF benchmark 2026 — Playwright vs Puppeteer vs WeasyPrint](https://pdf4.dev/blog/html-to-pdf-benchmark-2026)
- [Gotenberg: arquitectura de referencia para generación de PDF como microservicio](https://ayedo.de/en/posts/gotenberg-die-referenz-architektur-fur-pdf-generierung-als-microservice/)
- [HTML Print Pagination & Footer: 6 Approaches Compared](https://www.customjs.space/blog/html-print-pagination-footer/)
- [SII — Formato Documentos Tributarios Electrónicos, versión 2.5 (febrero 2026)](https://www.sii.cl/factura_electronica/factura_mercado/formato_dte_202602.pdf)

---

*Frutera Agrosan · Etapa 4 — Especificación técnica · VIAIN Asesorías Informáticas · Agosto 2026*
*Versión 0.1 — Propuesta para revisión · Confidencial*
