import { Documento } from '../../../ui/Documento.js'
import { Encabezado } from '../../../ui/Encabezado.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import type { SolicitudInspeccionPdfPayload } from '../../../schemas/solicitud-inspeccion.schema.js'

function listaOGuion(valores: string[]): string {
  return valores.length > 0 ? valores.join(', ') : '—'
}

// v1 — sin control de copia (Etapa 4 §8). Sin tabla de líneas: la Solicitud
// no trae montos ni cajas por línea, es el pedido de visita en sí (ver nota
// en solicitud-inspeccion.schema.ts).
export function SolicitudInspeccionV1({ d, marcaAgua, marcaAguaFecha }: { d: SolicitudInspeccionPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  return (
    <Documento
      titulo={`Solicitud de Inspección ${d.codigo}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      marcaAgua={marcaAgua}
      marcaAguaFecha={marcaAguaFecha}
      piePagina='Frutera Agrosan · Documento generado electrónicamente'
    >
      <Encabezado
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento='Solicitud de Inspección'
        numero={d.codigo}
        fecha={fmt.fecha(d.fecha)}
        subtitulo={`Estado: ${d.estado}`}
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
            { label: 'Razón social', valor: d.productor.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.productor.rut) },
            { label: 'Dirección de la visita', valor: d.productor.direccion ?? '—' },
            { label: 'Contacto', valor: d.productor.contacto ?? '—' },
          ]}
        />
      </div>

      {/* Reagrupación 2026-08-19 (feedback Christian): Especie/Cantidad de
          pallets/Calificación se mueven a "Producto a Inspeccionar" (antes
          "Alcance") y Países se mueve para acá, junto al resto de los datos
          de la visita en sí. */}
      <GrupoCampos
        titulo='Detalle de la visita'
        campos={[
          { label: 'Fecha y hora', valor: fmt.fechaHora(d.fechaHoraVisita) },
          { label: 'Mercado', valor: d.mercado ?? '—' },
          { label: 'Cliente', valor: d.cliente ?? '—' },
          { label: 'Fecha de despacho', valor: d.fechaDespacho ? fmt.fecha(d.fechaDespacho) : '—' },
          { label: 'Países', valor: listaOGuion(d.paises) },
        ]}
      />

      <GrupoCampos
        titulo='Producto a Inspeccionar'
        campos={[
          { label: 'Especie', valor: d.especie ?? '—' },
          { label: 'Cantidad de pallets', valor: d.cantidadPallets != null ? fmt.entero(d.cantidadPallets) : '—' },
          { label: 'Nota de Calidad', valor: d.notaCalidad ?? '—' },
          { label: 'Nota de Condición', valor: d.notaCondicion ?? '—' },
          { label: 'Variedades', valor: listaOGuion(d.variedades) },
          { label: 'Calibres', valor: listaOGuion(d.calibres) },
          { label: 'Categorías', valor: listaOGuion(d.categorias) },
          { label: 'Artículos', valor: listaOGuion(d.articulos) },
        ]}
      />

      <GrupoCampos
        titulo='Asignados'
        campos={
          d.asignados.length > 0
            ? d.asignados.map((a) => ({ label: a.funcion, valor: a.nombre }))
            : [{ label: 'Asignados', valor: '—' }]
        }
      />

      {d.observaciones && (
        <GrupoCampos titulo='Observaciones' campos={[{ label: '', valor: d.observaciones }]} />
      )}

      {d.cierre && (
        <GrupoCampos
          titulo='Cierre'
          campos={[
            { label: 'Resultado', valor: d.cierre.resultado },
            { label: 'Fecha de cierre', valor: d.cierre.fecha ? fmt.fecha(d.cierre.fecha) : '—' },
            { label: 'Comentarios', valor: d.cierre.comentarios ?? '—' },
          ]}
        />
      )}

      <PieFirma firmantes={[d.usuarioSolicitante, 'Productor']} />
    </Documento>
  )
}
