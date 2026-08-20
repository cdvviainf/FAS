import { Documento } from '../../../ui/Documento.js'
import { Encabezado } from '../../../ui/Encabezado.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import type { InstructivoEmbalajePdfPayload } from '../../../schemas/instructivo-embalaje.schema.js'

type Linea = InstructivoEmbalajePdfPayload['detalle'][number]

const columnas: ColumnaTabla<Linea>[] = [
  { titulo: 'Especie', render: (l) => l.especie },
  { titulo: 'Variedad', render: (l) => l.variedad },
  { titulo: 'Var. Rotulada', render: (l) => l.variedadRotulada ?? '—' },
  { titulo: 'Categoría', render: (l) => l.categoria },
  { titulo: 'Artículo', render: (l) => l.articulo },
  { titulo: 'Etiqueta', render: (l) => l.etiqueta ?? '—' },
  { titulo: 'Calibres', render: (l) => l.calibres },
  { titulo: 'Tipo Pallet', render: (l) => l.tipoPallet ?? '—' },
  { titulo: 'Altura', render: (l) => l.altura },
  // Kg Neto Envase (feedback Christian, 2026-08-19): dato de catálogo, sin
  // total (a diferencia de OC/Cierre Comercial, acá no se pidió Kg Bruto).
  { titulo: 'Kg Neto Envase', render: (l) => l.kgNetoEnvase ? fmt.kilos(l.kgNetoEnvase) : '—', numerica: true },
  { titulo: 'Pallets', render: (l) => fmt.entero(l.cantidadPallets), numerica: true },
  { titulo: 'Cajas/Pallet', render: (l) => fmt.entero(l.cajasPorPallet), numerica: true },
  { titulo: 'Cajas', render: (l) => fmt.entero(l.cajas), numerica: true },
]

// v1 — sin control de copia (Etapa 4 §8, ver documentos.types.ts): nunca
// recibe marcaAgua desde el service (siempre undefined), pero la firma se
// mantiene igual a la de los demás documentos del registro.
export function InstructivoEmbalajeV1({ d, marcaAgua, marcaAguaFecha }: { d: InstructivoEmbalajePdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  return (
    <Documento
      titulo={`Instructivo de Embalaje N° ${d.numero}`}
      paginaOpts={{ formato: 'A4', orientacion: 'landscape', margen: '14mm 12mm 16mm' }}
      marcaAgua={marcaAgua}
      marcaAguaFecha={marcaAguaFecha}
      piePagina='Frutera Agrosan · Documento generado electrónicamente'
    >
      <Encabezado
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento='Instructivo de Embalaje'
        numero={d.numero}
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
          titulo='Productor'
          campos={[
            { label: 'Razón social', valor: d.productor.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.productor.rut) },
            { label: 'Dirección', valor: d.productor.direccion ?? '—' },
            { label: 'Contacto', valor: d.productor.contacto ?? '—' },
          ]}
        />
      </div>

      <GrupoCampos
        titulo='Programa'
        campos={[
          { label: 'Grupo de Mercado', valor: d.grupoMercado },
          {
            label: 'Fecha inicio programa',
            // Semana ISO (feedback Christian, 2026-08-19), mismo cálculo que
            // el badge del formulario — debajo de la fecha, no aparte, para
            // no sumar un GrupoCampos nuevo.
            valor: (
              <>
                {fmt.fecha(d.fechaInicioPrograma)}
                <br />
                Semana {d.semana}
              </>
            ),
          },
        ]}
      />

      {d.observaciones && (
        <GrupoCampos titulo='Observaciones' campos={[{ label: '', valor: d.observaciones }]} />
      )}

      <TablaLineas
        titulo='Detalle de embalaje'
        filas={d.detalle}
        columnas={columnas}
        totales={['', '', '', '', '', '', '', '', 'Total:', '', fmt.entero(d.totales.pallets), '', fmt.entero(d.totales.cajas)]}
      />

      <PieFirma firmantes={['Frutera Agrosan', 'Productor']} />
    </Documento>
  )
}
