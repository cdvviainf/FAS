// Firmante: texto simple (compatibilidad) o un objeto con imagen de firma
// opcional (2026-11-05, PNG transparente del usuario — UsuarioFirma) que se
// estampa SOBRE la línea de firma, y un detalle bajo el nombre (ej. cargo).
export type Firmante = string | { nombre: string; imagenDataUri?: string | null; detalle?: string | null }

interface PieFirmaProps {
  nota?: string
  firmantes: Firmante[]
}

export function PieFirma({ nota, firmantes }: PieFirmaProps) {
  const normalizados = firmantes.map((f) => (typeof f === 'string' ? { nombre: f } : f))
  // Si algún firmante trae imagen, todos reservan el mismo alto para que las
  // líneas de firma queden alineadas.
  const conImagen = normalizados.some((f) => 'imagenDataUri' in f && f.imagenDataUri)
  return (
    <>
      {nota && <p className='doc-nota-legal'>{nota}</p>}
      <div className='doc-pie-firma'>
        {normalizados.map((f, i) => (
          <div className='doc-firma' key={i}>
            {conImagen && (
              <div className='doc-firma-espacio'>
                {'imagenDataUri' in f && f.imagenDataUri && <img className='doc-firma-imagen' src={f.imagenDataUri} alt='' />}
              </div>
            )}
            <div className={conImagen ? 'doc-firma-linea doc-firma-linea--con-imagen' : 'doc-firma-linea'} />
            <div>{f.nombre}</div>
            {'detalle' in f && f.detalle && <div className='doc-firma-detalle'>{f.detalle}</div>}
          </div>
        ))}
      </div>
    </>
  )
}
