// Estilos propios de la OC v3 (2026-11-06) — prefijo `oc3-` para no tocar las
// clases compartidas de print-css.ts (que siguen usando v1/v2 y los demás
// documentos). Paleta: azul corporativo de la referencia
// Docs/Orden de Compra Corporativa de Frutas.png.
const AZUL = '#123E7C'
const AZUL_TEXTO = '#0D2245'
const FONDO = '#F1F4F9'
const BORDE = '#D5DCE7'
const GRIS = '#4A5568'

export const ocV3Css = `
  body { font-size: 8.5pt; color: ${AZUL_TEXTO}; }
  .doc-footer-empresa { display: none; }

  /* ── Cabecera ── */
  .oc3-cab { display: flex; justify-content: space-between; align-items: stretch; margin-bottom: 3mm; min-height: 31mm; }
  .oc3-cab-izq { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding-right: 4mm; }
  .oc3-cab-logo img { max-height: 17mm; max-width: 95mm; object-fit: contain; }
  .oc3-cab-titulo { font-size: 20pt; font-weight: 800; color: ${AZUL}; letter-spacing: 0.3pt; margin-top: 2mm; line-height: 1.1; }
  .oc3-cab-numero { font-size: 11pt; color: ${AZUL}; }
  .oc3-sep { color: ${BORDE}; margin: 0 2mm; }
  .oc3-cab-especie { width: 66mm; overflow: hidden; clip-path: polygon(14% 0, 100% 0, 100% 100%, 0 100%); }
  .oc3-cab-especie img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .oc3-cab-compacta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5mm; padding-bottom: 3mm; }
  .oc3-cab-compacta-info { text-align: right; color: ${AZUL}; font-size: 10pt; }
  .oc3-cab-compacta-titulo { font-size: 16pt; font-weight: 800; }

  /* ── Secciones (barra azul + tarjeta) ── */
  .oc3-seccion { border-radius: 2.5mm; overflow: hidden; background: ${FONDO}; margin-bottom: 2.5mm; break-inside: avoid; }
  .oc3-seccion-titulo { background: ${AZUL}; color: #fff; font-weight: 700; font-size: 9.5pt; padding: 1.3mm 4mm; letter-spacing: 0.3pt; display: flex; align-items: center; gap: 2mm; }
  .oc3-seccion-titulo .oc3-icono { width: 4.5mm; height: 4.5mm; color: #fff; }
  .oc3-seccion-cuerpo { padding: 2mm 4mm; }
  .oc3-seccion-tabla { break-inside: auto; }
  .oc3-seccion-tabla .oc3-seccion-cuerpo { padding: 0; background: #fff; }
  .oc3-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
  .oc3-grid-2 > .oc3-seccion { margin-bottom: 0; }
  .oc3-grid-2 { margin-bottom: 2.5mm; }
  .oc3-sin-gap { margin-bottom: 0; row-gap: 0; }
  .oc3-grid-terminos { grid-template-columns: 1.45fr 1fr; }

  .oc3-razon { font-weight: 700; font-size: 10pt; margin-bottom: 1mm; }
  .oc3-fila { display: grid; grid-template-columns: 22mm 1fr; gap: 2mm; line-height: 1.3; }
  .oc3-fila-label { color: ${GRIS}; }
  .oc3-espacio { height: 1.2mm; }

  .oc3-icono { display: inline-flex; width: 7mm; height: 7mm; color: ${AZUL}; flex-shrink: 0; }
  .oc3-icono svg { width: 100%; height: 100%; }

  .oc3-condiciones { display: grid; grid-template-columns: repeat(3, 1fr); }
  .oc3-condicion { display: flex; gap: 1.5mm; align-items: flex-start; padding: 0 2mm; border-left: 1px solid ${BORDE}; }
  .oc3-condicion .oc3-icono { width: 6mm; height: 6mm; }
  .oc3-condicion:first-child { border-left: none; padding-left: 0; }
  .oc3-condicion-label { font-weight: 700; }
  .oc3-calendario { display: flex; gap: 3mm; align-items: center; }
  .oc3-cuotas { display: grid; gap: 1mm; }
  .oc3-cuota { display: grid; grid-template-columns: 24mm 1fr; gap: 2mm; }

  /* ── Tabla de detalle ── */
  .oc3-tabla { width: 100%; border-collapse: collapse; font-size: 7pt; table-layout: auto; }
  .oc3-tabla th { background: ${FONDO}; color: ${AZUL_TEXTO}; font-weight: 700; padding: 1.5mm 1mm; border-bottom: 1px solid ${BORDE}; text-align: left; vertical-align: middle; }
  .oc3-tabla td { padding: 1.3mm 1mm; border-bottom: 1px solid ${BORDE}; vertical-align: middle; }
  .oc3-tabla .num { text-align: right; }
  .oc3-tabla td.num { white-space: nowrap; }
  .oc3-tabla th { white-space: normal; line-height: 1.15; }
  .oc3-tabla th.peso { min-width: 15mm; }
  .oc3-tabla tfoot td { font-weight: 800; font-size: 8.5pt; background: ${FONDO}; border-bottom: none; }
  .oc3-tabla thead { display: table-header-group; }
  .oc3-tabla tr { break-inside: avoid; }

  .oc3-bloque-final { break-inside: avoid; }
  .oc3-facturar div { line-height: 1.4; }
  .oc3-observaciones { white-space: pre-wrap; min-height: 6mm; }

  .oc3-nota-generica { font-size: 7.5pt; color: ${GRIS}; margin: 0 0 1mm; }

  /* ── Firmas ── */
  .oc3-firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 20mm; margin: 2mm 10mm 0; text-align: center; color: ${AZUL_TEXTO}; }
  .oc3-firma-espacio { height: 13mm; display: flex; align-items: flex-end; justify-content: center; }
  .oc3-firma-espacio img { max-height: 18mm; max-width: 60mm; object-fit: contain; margin-bottom: -2mm; }
  .oc3-firma-linea { border-top: 1px solid ${AZUL}; margin-bottom: 1.5mm; }
  .oc3-firma-detalle { color: ${GRIS}; font-size: 8pt; }

  /* ── Hoja 2: Términos ── */
  .oc3-hoja-terminos { break-before: page; }
  .oc3-terminos { border-radius: 2.5mm; overflow: hidden; background: ${FONDO}; }
  .oc3-terminos > .oc3-seccion-titulo { font-size: 11pt; padding: 2.5mm 5mm; }
  .oc3-terminos-cuerpo { padding: 2mm 5mm; }
  .oc3-clausula { display: grid; grid-template-columns: 9mm 12mm 1fr; gap: 3mm; padding: 4mm 0; border-bottom: 1px solid ${BORDE}; break-inside: avoid; }
  .oc3-clausula:last-child { border-bottom: none; }
  .oc3-clausula-num { width: 8mm; height: 8mm; border-radius: 50%; background: ${AZUL}; color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 10pt; }
  .oc3-clausula-icono .oc3-icono { width: 9mm; height: 9mm; }
  .oc3-clausula-titulo { font-weight: 700; font-size: 10pt; margin-bottom: 1mm; }
  .oc3-clausula-texto { color: ${GRIS}; line-height: 1.45; text-align: justify; }
  .oc3-nota { display: flex; gap: 3mm; align-items: center; background: ${FONDO}; border-radius: 2.5mm; padding: 3mm 5mm; margin-top: 4mm; color: ${GRIS}; break-inside: avoid; }
`
