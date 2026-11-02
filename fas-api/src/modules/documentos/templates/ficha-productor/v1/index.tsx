import { Documento } from '../../../ui/Documento.js'
import { Encabezado } from '../../../ui/Encabezado.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { fmt } from '../../../ui/formato.js'
import type { FichaProductorPdfPayload } from '../../../schemas/ficha-productor.schema.js'

type Predio = FichaProductorPdfPayload['predios'][number]
type LineaContrato = NonNullable<FichaProductorPdfPayload['contrato']>['lineas'][number]

const columnasPredios: ColumnaTabla<Predio>[] = [
  { titulo: 'Código', render: (p) => p.codigo },
  { titulo: 'Nombre', render: (p) => p.descripcion },
  { titulo: 'Comuna', render: (p) => p.comuna ?? '—' },
  { titulo: 'Tipo Producción', render: (p) => p.tipoProduccion ?? '—' },
  { titulo: 'Dirección', render: (p) => p.direccion ?? '—' },
]

const columnasContrato: ColumnaTabla<LineaContrato>[] = [
  { titulo: 'Embalaje', render: (l) => l.articulo },
  { titulo: 'Variedad', render: (l) => l.variedad },
  { titulo: 'Calibre', render: (l) => l.calibre },
  { titulo: 'Categoría', render: (l) => l.categoria },
  { titulo: 'Unidad', render: (l) => l.unidad },
  { titulo: 'Comprometido', render: (l) => fmt.entero(l.cantidadComprometida), numerica: true },
  { titulo: 'Mínimo Gar.', render: (l) => fmt.entero(l.minimoGarantizado), numerica: true },
]

// v1 — ficha de datos maestros del productor. Sin control de copia (Etapa 4 §8).
export function FichaProductorV1({ d }: { d: FichaProductorPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  const { productor: p } = d
  return (
    <Documento
      titulo={`Ficha de Productor ${p.codigo}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      piePagina='Frutera Agrosan · Documento generado electrónicamente'
    >
      <Encabezado
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento='Ficha de Productor'
        numero={p.codigo}
        fecha={fmt.fecha(d.fechaGeneracion)}
        subtitulo={`Estado: ${p.activo ? 'Activo' : 'Inactivo'}`}
      />

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Exportador'
          campos={[
            { label: 'Razón social', valor: d.empresa.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.empresa.rut) },
          ]}
        />
        <GrupoCampos
          titulo='Productor'
          campos={[
            { label: 'Nombre', valor: p.descripcion },
            { label: 'Razón social', valor: p.razonSocial },
            { label: 'RUT', valor: fmt.rut(p.rut) },
            { label: 'País', valor: p.pais ?? '—' },
            { label: 'Teléfono', valor: p.telefono ?? '—' },
            { label: 'Email', valor: p.email ?? '—' },
          ]}
        />
      </div>

      {p.direcciones.length > 0 && (
        <GrupoCampos
          titulo='Direcciones'
          campos={p.direcciones.map((dir) => ({
            label: dir.descripcion,
            valor: [dir.direccion, dir.comuna, dir.pais].filter(Boolean).join(', ') || '—',
          }))}
        />
      )}

      {p.contactos.length > 0 && (
        <GrupoCampos
          titulo='Contactos'
          campos={p.contactos.map((c) => ({
            label: c.esRepresentanteLegal ? `${c.nombre} (Rep. legal)` : c.nombre,
            valor: [c.tipo, c.rut, c.telefono, c.email].filter(Boolean).join(' · ') || '—',
          }))}
        />
      )}

      {d.predios.length > 0 ? (
        <TablaLineas titulo='Predios' filas={d.predios} columnas={columnasPredios} />
      ) : (
        <GrupoCampos titulo='Predios' campos={[{ label: 'Predios', valor: 'Sin predios registrados' }]} />
      )}

      {d.contrato ? (
        <>
          <GrupoCampos
            titulo='Contrato vigente'
            campos={[
              { label: 'Temporada', valor: d.contrato.temporada },
              { label: 'Especie', valor: d.contrato.especie },
              { label: 'Inicio', valor: fmt.fecha(d.contrato.fechaInicio) },
              { label: 'Término', valor: fmt.fecha(d.contrato.fechaTermino) },
            ]}
          />
          {d.contrato.lineas.length > 0 && (
            <TablaLineas titulo='Detalle del contrato' filas={d.contrato.lineas} columnas={columnasContrato} />
          )}
        </>
      ) : (
        <GrupoCampos titulo='Contrato' campos={[{ label: 'Contrato', valor: 'Sin contrato registrado' }]} />
      )}
    </Documento>
  )
}
