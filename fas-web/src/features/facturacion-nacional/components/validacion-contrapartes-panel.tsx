'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ContraparteValidacion, ValidacionFacturaNacional } from '../types'

// Panel pre-vuelo (2026-11-07): datos de emisor y receptor que irán en el DTE,
// con los faltantes en rojo — mismo criterio que la Guía de despacho y el
// Generador DTE. "Enviar al SII" se deshabilita mientras haya faltantes (el
// backend bloquea con la misma lista).
function TablaContraparte({ titulo, datos, ayuda }: { titulo: string; datos: ContraparteValidacion; ayuda: string }) {
  return (
    <div className='rounded-md border p-3'>
      <p className='mb-1 text-sm font-medium'>{titulo}</p>
      <table className='w-full text-sm'>
        <tbody>
          {datos.campos.map((c) => (
            <tr key={c.campo} className={c.valor == null ? 'text-destructive' : ''}>
              <td className='w-32 py-0.5 pr-3'>{c.etiqueta} <span className='text-destructive'>*</span></td>
              <td className='py-0.5'>{c.valor ?? `⚠ Sin ${c.etiqueta.toLowerCase()}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {datos.faltantes.length > 0 && <p className='text-destructive mt-2 text-xs'>{ayuda}</p>}
    </div>
  )
}

export function ValidacionContrapartesPanel({ validacion }: { validacion: ValidacionFacturaNacional }) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between gap-2 space-y-0'>
        <CardTitle className='text-base'>Datos de emisor y receptor en el documento</CardTitle>
        {validacion.faltantes.length > 0 ? (
          <Badge variant='destructive'>Faltan {validacion.faltantes.length} dato(s)</Badge>
        ) : (
          <Badge className='bg-emerald-600'>Completo</Badge>
        )}
      </CardHeader>
      <CardContent className='grid gap-3 md:grid-cols-2'>
        <TablaContraparte
          titulo='Emisor (Empresa)'
          datos={validacion.emisor}
          ayuda='Completa los datos en Configuración → Empresas. La dirección y comuna salen de su dirección por defecto.'
        />
        <TablaContraparte
          titulo='Receptor (Cliente)'
          datos={validacion.receptor}
          ayuda='Completa los datos en la ficha de la entidad (Entidades). La dirección y comuna salen de su dirección por defecto.'
        />
      </CardContent>
    </Card>
  )
}
