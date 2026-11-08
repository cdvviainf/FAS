interface EncabezadoProps {
  logoDataUri?: string
  tituloDocumento: string // ej. "Orden de Compra / Purchase Order"
  numero: string
  fecha: string // ya formateada (fmt.fecha) — este componente no formatea
  subtitulo?: string // ej. nombre del responsable
  // Etiqueta de estado (2026-11-07): BORRADOR/COPIA como etiqueta celeste bajo
  // el folio (mismo estilo que OC v3), en lugar de la marca de agua diagonal.
  // `texto` ya viene en el idioma del documento; `fecha` solo para COPIA.
  marca?: { tipo: 'BORRADOR' | 'COPIA'; texto: string; fecha?: string }
}

// Franja superior — logo a la izquierda, folio/fecha a la derecha. Igual en
// los 18 documentos del catálogo (Etapa 4 §5).
export function Encabezado({ logoDataUri, tituloDocumento, numero, fecha, subtitulo, marca }: EncabezadoProps) {
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
        {marca && (
          <div className='doc-estado-fila'>
            <span className={`doc-estado ${marca.tipo === 'BORRADOR' ? 'doc-estado--borrador' : 'doc-estado--copia'}`}>
              {marca.texto}
              {marca.tipo === 'COPIA' && marca.fecha ? <span className='doc-estado-fecha'>{marca.fecha}</span> : null}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
