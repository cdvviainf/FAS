import { DOC_TOKENS as T } from './tokens.js'

// Hoja de estilos propia para impresión (Etapa 4 §6) — sin Tailwind: no
// maneja @page, no piensa en milímetros y sus utilidades no sirven para el
// control de saltos que un documento impreso necesita. Se entrega como
// string (no un archivo .css estático) porque el render no sirve nada por
// HTTP — todo el HTML, incluido el CSS, viaja inline en un solo string
// hacia Playwright (Etapa 4 §1: "el preview es el PDF", sin red de por
// medio, ver render.ts).
//
// Paginación editorial (Paged.js) queda fuera de esta etapa a propósito: el
// piloto (Orden de Compra) es de una sola página ("modo simple", Etapa 4
// §6 "Paginación editorial"). Se agrega cuando entre el primer documento
// multipágina real (liquidación, packing list).
export function printCss(pagina: { formato: 'A4' | 'Letter'; orientacion: 'portrait' | 'landscape'; margen: string }): string {
  return `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
      color: ${T.tinta};
      font-size: 10.5pt;
      line-height: 1.35;
    }

    @page {
      size: ${pagina.formato} ${pagina.orientacion};
      margin: ${pagina.margen};
    }
    /* FAS-DOC-R1-001 (ronda QA 1): @page.margin solo lo aplica Playwright al
       imprimir — en pantalla (el iframe de DocumentoPreviewDialog) el
       contenido corría borde a borde, sin el margen real que sí tiene el
       PDF. Se replica como padding solo para screen — el PDF sigue usando
       exclusivamente @page (que además controla el salto de página, algo
       que un padding en el body no puede hacer). */
    @media screen {
      body { padding: ${pagina.margen}; }
    }

    h1, h2, h3 { margin: 0 0 4mm 0; color: ${T.tinta}; break-after: avoid; }
    p { margin: 0 0 2mm 0; orphans: 3; widows: 3; }

    .doc-marca-agua {
      position: fixed;
      top: 45%;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 72pt;
      font-weight: 700;
      color: ${T.negativo};
      opacity: 0.12;
      transform: rotate(-28deg);
      z-index: 0;
      pointer-events: none;
    }
    .doc-marca-agua-fecha { font-size: 14pt; font-weight: 400; margin-top: 2mm; }

    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid ${T.acento};
      padding-bottom: 3mm;
      margin-bottom: 4mm;
    }
    .doc-header img.doc-logo { max-height: 16mm; }
    .doc-header .doc-folio { text-align: right; font-size: 9pt; color: ${T.acento}; }
    /* Tipo de documento grande y en negrita (feedback Christian, 2026-08-20,
       en las 4 plantillas vía Encabezado.tsx) — antes heredaba el 9pt de
       .doc-folio y quedaba casi ilegible comparado con el N°. */
    .doc-header .doc-folio .doc-titulo { font-size: 16pt; font-weight: 700; margin-bottom: 1mm; }
    .doc-header .doc-folio .doc-numero { font-size: 13pt; font-weight: 700; color: ${T.tinta}; }

    .doc-grupo { break-inside: avoid; margin-bottom: 4mm; }
    .doc-grupo-titulo {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${T.acento};
      border-bottom: 1px solid ${T.borde};
      margin-bottom: 1.5mm;
      padding-bottom: 0.5mm;
    }

    .doc-fila-grupos { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8mm; }
    /* Una columna de label:valor por fila DENTRO de cada grupo — el 2 columnas
       ya lo da .doc-fila-grupos (dos grupos lado a lado); anidar otro grid de
       2 columnas acá dejaba ~8mm para el valor y lo partía letra por letra. */
    .doc-campos { display: flex; flex-direction: column; }
    .doc-campo { display: grid; grid-template-columns: 24mm 1fr; gap: 2mm; font-size: 9.5pt; padding: 0.6mm 0; }
    .doc-campo .doc-campo-label { color: #6b6558; }
    .doc-campo .doc-campo-valor { font-weight: 500; }

    /* Achicado 9pt/8.2pt -> 7.5pt/6.8pt (feedback Christian, 2026-08-19):
       la OC y el Cierre Comercial suman columnas de Kg por envase y
       terminan con 13-14 columnas — sin esto no entraban legibles en A4
       vertical. Aplica a las 4 plantillas por igual (Solicitud/Instructivo
       no tienen presión de columnas, pero conviene una sola tipografía de
       tabla en todo el motor). */
    table.doc-tabla { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
    .doc-tabla thead { display: table-header-group; }
    .doc-tabla tfoot { display: table-footer-group; }
    .doc-tabla th {
      background: ${T.tinta};
      color: #fff;
      text-align: left;
      padding: 1.3mm 1.5mm;
      font-weight: 600;
      font-size: 6.8pt;
    }
    .doc-tabla td { padding: 1.2mm 1.5mm; border-bottom: 1px solid ${T.borde}; }
    .doc-tabla tbody tr:nth-child(even) { background: ${T.zebra}; }
    .doc-tabla tfoot td { font-weight: 700; border-top: 1.5px solid ${T.tinta}; border-bottom: none; }

    .doc-num { font-variant-numeric: tabular-nums; text-align: right; }

    .doc-totales { break-inside: avoid; margin-top: 4mm; width: 70mm; margin-left: auto; }
    .doc-totales .doc-totales-linea {
      display: flex; justify-content: space-between; font-size: 9.5pt; padding: 1mm 0;
    }
    .doc-totales .doc-totales-neto {
      display: flex; justify-content: space-between; font-size: 11pt; font-weight: 700;
      border-top: 1.5px solid ${T.tinta}; padding-top: 1.5mm; margin-top: 1mm;
    }

    .doc-nota-legal { font-size: 7.5pt; color: #6b6558; margin-top: 5mm; white-space: pre-wrap; }

    .doc-pie-firma { break-inside: avoid; margin-top: 12mm; display: flex; gap: 12mm; }
    .doc-firma { flex: 1; text-align: center; font-size: 9pt; }
    .doc-firma .doc-firma-linea { border-top: 1px solid ${T.tinta}; margin-bottom: 1.5mm; padding-top: 10mm; }

    .doc-footer-empresa {
      font-size: 7.5pt;
      color: #6b6558;
      text-align: center;
      border-top: 1px solid ${T.borde};
      padding-top: 2mm;
      margin-top: 6mm;
    }
  `
}
