import { ICONOS, type NombreIcono } from './iconos.js'

// Componentes base del formato corporativo (2026-11-06): compartidos por la OC
// v3 y el Cierre Comercial v2. Clases `oc3-*` definidas en ./estilos.ts.

export function Icono({ nombre }: { nombre: NombreIcono }) {
  return <span className='oc3-icono' dangerouslySetInnerHTML={{ __html: ICONOS[nombre] }} />
}

export function Seccion({ titulo, icono, children, className }: { titulo: string; icono?: NombreIcono; children: React.ReactNode; className?: string }) {
  return (
    <section className={`oc3-seccion ${className ?? ''}`}>
      <div className='oc3-seccion-titulo'>
        {icono && <Icono nombre={icono} />}
        {titulo}
      </div>
      <div className='oc3-seccion-cuerpo'>{children}</div>
    </section>
  )
}

export function Fila({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className='oc3-fila'>
      <div className='oc3-fila-label'>{label}</div>
      <div className='oc3-fila-valor'>{valor}</div>
    </div>
  )
}

export function Lineas({ lineas }: { lineas: string[] }) {
  if (lineas.length === 0) return <>—</>
  return <>{lineas.map((l, i) => <div key={i}>{l}</div>)}</>
}

// Estado del documento como etiqueta junto al título: reemplaza la marca de agua
// diagonal. BORRADOR = preview no emitido; COPIA = reimpresión (con su fecha).
// Documento emitido → sin etiqueta.
export type MarcaEstado = { tipo: 'BORRADOR' | 'COPIA'; fecha?: string }
export function EtiquetaEstado({ marca, textoBorrador, textoCopia }: { marca?: MarcaEstado; textoBorrador: string; textoCopia: string }) {
  if (!marca) return null
  const esBorrador = marca.tipo === 'BORRADOR'
  return (
    <span className={`oc3-estado ${esBorrador ? 'oc3-estado--borrador' : 'oc3-estado--copia'}`}>
      {esBorrador ? textoBorrador : textoCopia}
      {!esBorrador && marca.fecha ? <span className='oc3-estado-fecha'>{marca.fecha}</span> : null}
    </span>
  )
}

export { ICONOS, type NombreIcono }
