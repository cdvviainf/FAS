interface EncabezadoProps {
  logoDataUri?: string
  tituloDocumento: string // ej. "Orden de Compra / Purchase Order"
  numero: string
  fecha: string // ya formateada (fmt.fecha) — este componente no formatea
  subtitulo?: string // ej. nombre del responsable
}

// Franja superior — logo a la izquierda, folio/fecha a la derecha. Igual en
// los 18 documentos del catálogo (Etapa 4 §5).
export function Encabezado({ logoDataUri, tituloDocumento, numero, fecha, subtitulo }: EncabezadoProps) {
  return (
    <div className='doc-header'>
      {logoDataUri ? <img className='doc-logo' src={logoDataUri} alt='Frutera Agrosan' /> : <div />}
      <div className='doc-folio'>
        {/* Tipo de documento grande y en negrita (feedback Christian,
            2026-08-20) — antes heredaba el tamaño chico de .doc-folio. */}
        <div className='doc-titulo'>{tituloDocumento}</div>
        <div className='doc-numero'>N° {numero}</div>
        <div>{fecha}</div>
        {subtitulo && <div>{subtitulo}</div>}
      </div>
    </div>
  )
}
