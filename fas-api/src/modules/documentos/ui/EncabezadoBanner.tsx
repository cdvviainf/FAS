interface EncabezadoBannerProps {
  logoDataUri?: string
  // Imagen de la especie relacionada (banner, mitad derecha). Opcional: si no
  // hay, queda solo el logo + espacio blanco.
  especieImagenDataUri?: string
  tituloDocumento: string // ej. "Orden de Compra / Purchase Order"
  numero: string
  fecha: string // ya formateada (fmt.fecha) — este componente no formatea
  subtitulo?: string // ej. nombre del responsable
}

// Encabezado tipo BANNER (2026-10-26): banda superior con el logo de la empresa
// a la IZQUIERDA (50%) e imagen de la especie a la DERECHA (50%), con espacio
// blanco al centro. Debajo, la fila de información del documento. Componente
// nuevo e independiente de `Encabezado` (que siguen usando las plantillas v1 ya
// emitidas, para no alterar sus reimpresiones — regla de versionado Etapa 4 §4).
export function EncabezadoBanner({ logoDataUri, especieImagenDataUri, tituloDocumento, numero, fecha, subtitulo }: EncabezadoBannerProps) {
  return (
    <div className='doc-encabezado'>
      <div className='doc-banner'>
        <div className='doc-banner-logo'>
          {logoDataUri ? <img src={logoDataUri} alt='' /> : null}
        </div>
        <div className='doc-banner-especie'>
          {especieImagenDataUri ? <img src={especieImagenDataUri} alt='' /> : null}
        </div>
      </div>
      <div className='doc-info'>
        <div className='doc-titulo'>{tituloDocumento}</div>
        <div className='doc-numero'>N° {numero}</div>
        <div>{fecha}</div>
        {subtitulo && <div>{subtitulo}</div>}
      </div>
    </div>
  )
}
