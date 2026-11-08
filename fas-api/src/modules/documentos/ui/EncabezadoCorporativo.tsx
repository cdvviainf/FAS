import { CabeceraCorporativa } from './corporativo/componentes.js'
import { cabeceraCorporativaCss } from './corporativo/estilos.js'

export interface EncabezadoCorporativoProps {
  logoDataUri?: string
  // Imagen de la especie (banda derecha). Sin imagen, la banda queda solo con el logo.
  especieImagenDataUri?: string | null
  tituloDocumento: string // ej. "Instructivo de Embalaje"
  numero: string
  fecha: string // ya formateada (fmt.fecha) — este componente no formatea
  subtitulo?: string // ej. nombre del responsable / estado
  // Etiquetas de la línea N° | fecha (por defecto en español; EN en los
  // documentos bilingües como la Proforma).
  etiquetaNumero?: string
  etiquetaFecha?: string
  // Etiqueta de estado BORRADOR/COPIA (2026-11-07). `texto` ya viene en el
  // idioma del documento; `fecha` solo para COPIA.
  marca?: { tipo: 'BORRADOR' | 'COPIA'; texto: string; fecha?: string }
}

// Cabecera corporativa para las plantillas de cabecera simple (versión v2 de
// cada documento, 2026-11-08): la MISMA de la OC v3 y el Cierre v2
// (CabeceraCorporativa) — banda logo + especie de igual alto, tipo de documento
// en grande y debajo N° y fecha de emisión. Trae su propio <style> para no
// alterar el HTML de las versiones v1 (reimpresiones idénticas, Etapa 4 §8).
export function EncabezadoCorporativo({
  logoDataUri,
  especieImagenDataUri,
  tituloDocumento,
  numero,
  fecha,
  subtitulo,
  etiquetaNumero = 'N°',
  etiquetaFecha = 'Fecha de emisión',
  marca,
}: EncabezadoCorporativoProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cabeceraCorporativaCss }} />
      <CabeceraCorporativa
      logoDataUri={logoDataUri}
      especieImagenDataUri={especieImagenDataUri}
      titulo={tituloDocumento}
      etiquetaNumero={etiquetaNumero}
      numero={numero}
      etiquetaFecha={etiquetaFecha}
      fecha={fecha}
      subtitulo={subtitulo}
      marca={marca ? { tipo: marca.tipo, fecha: marca.fecha } : undefined}
      textoBorrador={marca?.texto ?? 'BORRADOR'}
      textoCopia={marca?.texto ?? 'COPIA'}
      />
    </>
  )
}
