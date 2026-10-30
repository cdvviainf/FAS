'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { formatMonto, formatFechaCorta } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { operacionesNacionalOptions, facturasNacionalKeys } from '../queries'
import { facturaNacionalService } from '../service'
import type { EstadoOperacionNacional, OperacionNacional, OrigenFacturaNacional } from '../types'
import { ESTADO_OPERACION_LABELS, ORIGEN_FN_LABELS } from '../types'

const ITEM = 'FACT_NACIONAL'

const ESTADO_VARIANT: Record<EstadoOperacionNacional, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SIN_FACTURA: 'outline',
  BORRADOR: 'secondary',
  ENVIADA_SII: 'secondary',
  APROBADA: 'default',
  RECHAZADA: 'destructive',
  ANULADA: 'outline',
}

// Orígenes para el filtro. PROFORMA_PRODUCTOR aún no tiene operaciones (solo
// placeholder del enum), pero se ofrece para cuando exista.
const ORIGENES: OrigenFacturaNacional[] = ['VENTA_NACIONAL', 'PROFORMA_MATERIAL', 'PROFORMA_PRODUCTOR']
const ESTADOS: EstadoOperacionNacional[] = ['SIN_FACTURA', 'BORRADOR', 'ENVIADA_SII', 'APROBADA', 'RECHAZADA', 'ANULADA']

export function FacturasNacionalListingClient() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)

  const [q, setQ] = useState('')
  const [origen, setOrigen] = useState<OrigenFacturaNacional | 'TODOS'>('TODOS')
  const [estado, setEstado] = useState<EstadoOperacionNacional | 'TODOS'>('TODOS')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isPending } = useQuery(
    operacionesNacionalOptions({
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(origen !== 'TODOS' ? { origen } : {}),
      ...(estado !== 'TODOS' ? { estado } : {}),
      page,
      limit,
    }),
  )
  const operaciones = data?.data ?? []
  const meta = data?.meta

  const crear = useMutation({
    mutationFn: (op: OperacionNacional) =>
      op.tipoOperacion === 'EMBARQUE'
        ? facturaNacionalService.crearDesdeEmbarque(op.operacionId)
        : facturaNacionalService.crearDesdeProforma(op.operacionId),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: facturasNacionalKeys.all })
      toast.success(`Factura ${data.codigo} creada en borrador`)
      router.push(`/dashboard/facturacion/nacional/factura/${data.id}`)
    },
    onError: (err: Error) => toast.error(err.message || 'No se pudo crear la factura'),
  })

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPage(1)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Buscar</label>
          <Input
            placeholder='Referencia, cliente o código…'
            value={q}
            onChange={(e) => resetPage(setQ)(e.target.value)}
            className='w-64'
          />
        </div>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Origen</label>
          <Select value={origen} onValueChange={(v) => resetPage(setOrigen)(v as OrigenFacturaNacional | 'TODOS')}>
            <SelectTrigger className='w-52'><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value='TODOS'>Todos</SelectItem>
              {ORIGENES.map((o) => (
                <SelectItem key={o} value={o}>{ORIGEN_FN_LABELS[o]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Estado</label>
          <Select value={estado} onValueChange={(v) => resetPage(setEstado)(v as EstadoOperacionNacional | 'TODOS')}>
            <SelectTrigger className='w-44'><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value='TODOS'>Todos</SelectItem>
              {ESTADOS.map((e) => (
                <SelectItem key={e} value={e}>{ESTADO_OPERACION_LABELS[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='overflow-x-auto rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operación</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Factura</TableHead>
              <TableHead>DTE / Folio</TableHead>
              <TableHead className='text-right'>Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className='text-right'>Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={9} className='text-muted-foreground py-8 text-center'>Cargando…</TableCell>
              </TableRow>
            ) : operaciones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className='text-muted-foreground py-8 text-center'>No hay operaciones.</TableCell>
              </TableRow>
            ) : (
              operaciones.map((op) => {
                const estadoOp: EstadoOperacionNacional = op.factura?.estado ?? 'SIN_FACTURA'
                return (
                  <TableRow key={`${op.tipoOperacion}-${op.operacionId}`}>
                    <TableCell className='font-medium whitespace-nowrap'>{op.referencia}</TableCell>
                    <TableCell className='text-muted-foreground whitespace-nowrap text-sm'>{ORIGEN_FN_LABELS[op.origenClase]}</TableCell>
                    <TableCell>{op.cliente?.razonSocial ?? '—'}</TableCell>
                    <TableCell className='whitespace-nowrap'>{op.fecha ? formatFechaCorta(op.fecha) : '—'}</TableCell>
                    <TableCell className='whitespace-nowrap'>{op.factura?.codigo ?? '—'}</TableCell>
                    <TableCell className='whitespace-nowrap'>{op.factura ? `${op.factura.tipoDte}${op.factura.folio ? ` · ${op.factura.folio}` : ''}` : '—'}</TableCell>
                    <TableCell className='text-right tabular-nums whitespace-nowrap'>{op.factura ? formatMonto(op.factura.montoTotal) : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_VARIANT[estadoOp]}>{ESTADO_OPERACION_LABELS[estadoOp]}</Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      {op.factura ? (
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => router.push(`/dashboard/facturacion/nacional/factura/${op.factura!.id}`)}
                        >
                          <Icons.externalLink className='mr-1 h-4 w-4' /> Ver
                        </Button>
                      ) : (
                        <Button size='sm' disabled={!puedeEscribir || crear.isPending} onClick={() => crear.mutate(op)}>
                          <Icons.add className='mr-1 h-4 w-4' /> Crear factura
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className='flex items-center justify-end gap-2'>
          <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className='text-muted-foreground text-sm'>Página {page} de {meta.totalPages}</span>
          <Button variant='outline' size='sm' disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </div>
      )}
    </div>
  )
}
