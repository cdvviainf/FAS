import { Documento } from '../../../ui/Documento.js'
import { Encabezado } from '../../../ui/Encabezado.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import type { InstructivoEmbarquePdfPayload } from '../../../schemas/instructivo-embarque.schema.js'

type Linea = InstructivoEmbarquePdfPayload['lineas'][number]

const columnas: ColumnaTabla<Linea>[] = [
  { titulo: 'Pallet', render: (l) => l.numeroPallet },
  { titulo: 'Especie', render: (l) => l.especie },
  { titulo: 'Variedad', render: (l) => l.variedad },
  { titulo: 'Categoría', render: (l) => l.categoria },
  { titulo: 'Calibre', render: (l) => l.calibre },
  { titulo: 'Artículo', render: (l) => l.articulo },
  { titulo: 'Productor', render: (l) => l.productor },
  { titulo: 'Cajas', render: (l) => fmt.entero(l.cajas), numerica: true },
]

// v1 — sin control de copia (Etapa 4 §8, ver documentos.types.ts), mismo
// criterio que Instructivo de Embalaje: nunca recibe marcaAgua desde el
// service, pero la firma se mantiene igual a la de los demás documentos del
// registro. Un documento por InstructivoHijo (Planta/punto de retiro), no
// por Embarque completo — ver resolvers/instructivo-embarque.resolver.ts.
export function InstructivoEmbarqueV1({ d, marcaAgua, marcaAguaFecha }: { d: InstructivoEmbarquePdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  return (
    <Documento
      titulo={`Instructivo de Embarque ${d.codigo}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      marcaAgua={marcaAgua}
      marcaAguaFecha={marcaAguaFecha}
      piePagina='Frutera Agrosan · Documento generado electrónicamente'
    >
      <Encabezado
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento='Instructivo de Embarque'
        numero={d.codigo}
        fecha={fmt.fecha(d.fecha)}
      />

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Exportador'
          campos={[
            { label: 'Razón social', valor: d.empresa.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.empresa.rut) },
            { label: 'Dirección', valor: d.empresa.direccion ?? '—' },
          ]}
        />
        <GrupoCampos
          titulo='Cliente'
          campos={[
            { label: 'Razón social', valor: d.cliente.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.cliente.rut) },
            { label: 'Dirección', valor: d.cliente.direccion ?? '—' },
            { label: 'Consignatario', valor: d.consignatario ?? '—' },
            { label: 'Notify', valor: d.notify ?? '—' },
          ]}
        />
      </div>

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Planta de retiro'
          campos={[
            { label: 'Instructivo padre', valor: d.numeroInstructivoPadre },
            { label: 'Planta', valor: d.planta.razonSocial },
            { label: 'Dirección', valor: d.planta.direccion ?? '—' },
          ]}
        />
        <GrupoCampos
          titulo='Ruta y destino'
          campos={[
            { label: 'Tipo de embarque', valor: d.tipoEmbarque ?? '—' },
            { label: 'Mercado', valor: d.mercado ?? '—' },
            { label: 'País destino', valor: d.paisDestino ?? '—' },
            { label: 'Puerto destino', valor: d.puertoDestino ?? '—' },
            { label: 'Puerto de zarpe', valor: d.puertoZarpe ?? '—' },
          ]}
        />
      </div>

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Booking y transporte'
          campos={[
            { label: 'Naviera', valor: d.naviera ?? '—' },
            { label: 'Nave', valor: d.nave ?? '—' },
            { label: 'N° Booking', valor: d.numeroBooking ?? '—' },
            { label: 'N° Contenedor', valor: d.numeroContenedor ?? '—' },
            { label: 'Voyage Number', valor: d.voyageNumber ?? '—' },
            { label: 'Fecha de zarpe', valor: d.fechaZarpe ? fmt.fecha(d.fechaZarpe) : '—' },
          ]}
        />
        <GrupoCampos
          titulo='Documentación'
          campos={[
            { label: 'AWB / BL', valor: d.awbBl ?? '—' },
            { label: 'Depósito', valor: d.deposito ?? '—' },
            { label: 'Cutoff', valor: d.cutoffDate ? fmt.fecha(d.cutoffDate) : '—' },
            { label: 'Tipo de bultos', valor: d.tipoBultos ?? '—' },
            { label: 'Agente de aduana', valor: d.agenteAduana ?? '—' },
            { label: 'Embarcador', valor: d.embarcador ?? '—' },
          ]}
        />
      </div>

      <GrupoCampos
        titulo='Hitos en planta'
        campos={[
          // FAS-IE-QA-002 (QA ronda 1): fecha/hora completa, no solo fecha
          // (ventas.md R11 exige "fecha/hora de retiro" por planta).
          { label: 'Carga en planta', valor: d.fechaCargaPlanta ? fmt.fechaHora(d.fechaCargaPlanta) : '—' },
          { label: 'Stacking desde', valor: d.stackingDesde ? fmt.fechaHora(d.stackingDesde) : '—' },
          { label: 'Stacking hasta', valor: d.stackingHasta ? fmt.fechaHora(d.stackingHasta) : '—' },
        ]}
      />

      {d.observaciones && (
        <GrupoCampos titulo='Observaciones' campos={[{ label: '', valor: d.observaciones }]} />
      )}

      <TablaLineas
        titulo='Detalle de carga'
        filas={d.lineas}
        columnas={columnas}
        totales={['', '', '', '', '', '', 'Total:', fmt.entero(d.totales.cajas)]}
      />

      <PieFirma firmantes={['Frutera Agrosan', 'Planta']} />
    </Documento>
  )
}
