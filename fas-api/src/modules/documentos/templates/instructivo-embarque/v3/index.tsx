// v2 (2026-11-08, QA/plan-cabecera-corporativa-nov2026.md): igual a v1 con la cabecera
// corporativa única (EncabezadoCorporativo). v1 queda congelada para reimpresiones.
import { Documento } from '../../../ui/Documento.js'
import { EncabezadoCorporativo } from '../../../ui/EncabezadoCorporativo.js'
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
  { titulo: 'Peso Neto', render: (l) => fmt.kilos(l.pesoNeto), numerica: true },
  { titulo: 'Peso Bruto', render: (l) => fmt.kilos(l.pesoBruto), numerica: true },
]

// v1 — sin control de copia (Etapa 4 §8, ver documentos.types.ts), mismo
// criterio que Instructivo de Embalaje: nunca recibe marcaAgua desde el
// service, pero la firma se mantiene igual a la de los demás documentos del
// registro. Un documento por InstructivoHijo (Planta/punto de retiro), no
// por Embarque completo — ver resolvers/instructivo-embarque.resolver.ts.
type Actor = NonNullable<InstructivoEmbarquePdfPayload['consignatario']>

// Datos completos de un actor (Consignatario/Notify) que exige la AGA.
function camposActor(a: Actor) {
  return [
    { label: 'Razón social', valor: a.razonSocial },
    { label: 'RUT', valor: fmt.rut(a.rut) },
    { label: 'TaxId', valor: a.taxId ?? '—' },
    { label: 'Dirección', valor: a.direccion ?? '—' },
    { label: 'Teléfono', valor: a.telefono ?? '—' },
    { label: 'Contacto', valor: [a.contacto, a.contactoTelefono].filter(Boolean).join(' · ') || '—' },
  ]
}

export function InstructivoEmbarqueV3({ d, marcaAgua, marcaAguaFecha }: { d: InstructivoEmbarquePdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  return (
    <Documento
      titulo={`Instructivo de Embarque ${d.codigo}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      marcaAgua={marcaAgua}
      marcaAguaFecha={marcaAguaFecha}
      piePagina='Frutera Agrosan · Documento generado electrónicamente'
    >
      <EncabezadoCorporativo
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        especieImagenDataUri={d.especieImagenDataUri ?? null}
        tituloDocumento='Instructivo de Embarque'
        numero={d.codigo}
        fecha={fmt.fecha(d.fecha)}
      />

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Exportador'
          campos={
            // Venta NACIONAL: exporta el cliente (exportadora); exportación:
            // exporta la empresa emisora (2026-10-17).
            d.exportador
              ? [
                  { label: 'Razón social', valor: d.exportador.razonSocial },
                  { label: 'RUT', valor: fmt.rut(d.exportador.rut) },
                ]
              : [
                  { label: 'Razón social', valor: d.empresa.razonSocial },
                  { label: 'RUT', valor: fmt.rut(d.empresa.rut) },
                  { label: 'Dirección', valor: d.empresa.direccion ?? '—' },
                ]
          }
        />
        <GrupoCampos
          titulo='Cliente'
          campos={[
            { label: 'Razón social', valor: d.cliente.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.cliente.rut) },
            { label: 'TaxId', valor: d.cliente.taxId ?? '—' },
            { label: 'Dirección', valor: d.cliente.direccion ?? '—' },
          ]}
        />
      </div>

      {/* Consignatario (AGA) — sólo cuando difiere del Cliente, con sus datos
          completos. Notify (v3, 2026-11-10): TODOS los asociados al Cliente en
          su ficha, en orden; si el propio cliente actúa como Notify va primero
          sin repetir sus datos (ya están en el bloque Cliente). */}
      {(() => {
        const notifies = d.notifies ?? []
        const grupos = [
          ...(d.consignatario
            ? [
                <GrupoCampos
                  key='consignatario'
                  titulo='Consignatario'
                  campos={camposActor(d.consignatario)}
                />,
              ]
            : []),
          ...(d.clienteEsNotify
            ? [
                <GrupoCampos
                  key='notify-cliente'
                  titulo={notifies.length > 0 ? 'Notify 1' : 'Notify'}
                  campos={[{ label: 'Razón social', valor: `${d.cliente.razonSocial} (el mismo cliente)` }]}
                />,
              ]
            : []),
          ...notifies.map((n, i) => {
            const total = notifies.length + (d.clienteEsNotify ? 1 : 0)
            const numero = i + 1 + (d.clienteEsNotify ? 1 : 0)
            return <GrupoCampos key={`notify-${i}`} titulo={total > 1 ? `Notify ${numero}` : 'Notify'} campos={camposActor(n)} />
          }),
        ]
        const filas: (typeof grupos)[] = []
        for (let k = 0; k < grupos.length; k += 2) filas.push(grupos.slice(k, k + 2))
        return filas.map((fila, k) => (
          <div key={`fila-actores-${k}`} className='doc-fila-grupos'>
            {fila}
          </div>
        ))
      })()}

      {/* Tipo de venta: sección propia en la columna izquierda, sobre Planta de
          retiro (Tipo de flete / Modalidad de venta / Incoterm). */}
      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Tipo de venta'
          campos={[
            { label: 'Tipo de flete', valor: d.tipoFlete ?? '—' },
            { label: 'Modalidad de venta', valor: d.modalidadVenta ?? '—' },
            { label: 'Incoterm', valor: d.incoterm ?? '—' },
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
            { label: 'Fecha de arribo', valor: d.fechaArribo ? fmt.fecha(d.fechaArribo) : '—' },
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
        titulo='Hitos en planta y stacking'
        campos={[
          // FAS-IE-QA-002 (QA ronda 1): fecha/hora completa, no solo fecha
          // (ventas.md R11 exige "fecha/hora de retiro" por planta).
          { label: 'Carga en planta', valor: d.fechaCargaPlanta ? fmt.fechaHora(d.fechaCargaPlanta) : '—' },
          // Stacking (2026-09-22): N rangos compartidos por todo el Embarque
          // (no por Planta) — mismos rangos en todos los InstructivoHijo.
          ...(d.stackingRangos.length > 0
            ? d.stackingRangos.map((r, i) => ({
                label: d.stackingRangos.length > 1 ? `Stacking ${i + 1}` : 'Stacking',
                valor: `${fmt.fechaHora(r.desde)} a ${fmt.fechaHora(r.hasta)}`,
              }))
            : [{ label: 'Stacking', valor: '—' }]),
        ]}
      />

      {d.observacionesGenerales && (
        <GrupoCampos titulo='Observaciones Generales' campos={[{ label: '', valor: d.observacionesGenerales }]} />
      )}

      {d.observaciones && (
        <GrupoCampos titulo='Observaciones Planta' campos={[{ label: '', valor: d.observaciones }]} />
      )}

      <TablaLineas
        titulo='Detalle de carga'
        filas={d.lineas}
        columnas={columnas}
        totales={['', '', '', '', '', '', 'Total:', fmt.entero(d.totales.cajas), fmt.kilos(d.totales.pesoNeto), fmt.kilos(d.totales.pesoBruto)]}
      />

      <PieFirma firmantes={['Frutera Agrosan', 'Planta']} />
    </Documento>
  )
}
