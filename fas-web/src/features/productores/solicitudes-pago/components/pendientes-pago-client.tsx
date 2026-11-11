'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { AvisoSinTemporada } from '@/components/shared/aviso-sin-temporada'
import { useTemporada } from '@/contexts/temporada-context'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { formatFechaCorta, formatMonto } from '@/lib/format'
import { solicitudesPagoKeys, solicitudesPagoService } from '../service'
import { ITEM_SOLICITUD_PAGO } from '../types'
import { claveCuota } from './despachado-selector'

const REFERENCIA_LABELS: Record<string, string> = {
  FACTURA: 'desde factura',
  ZARPE: 'desde zarpe',
  ENVIO_DOCUMENTOS: 'desde envío de documentos',
  ARRIBO: 'desde arribo',
}

// Cuotas pendientes de pago (lo despachado por OC × Embarque con saldo) de
// todos los productores, en OC de la temporada activa. Se seleccionan cuotas
// de UN productor y UNA moneda y se abre la solicitud prellenada.
export function PendientesPagoClient() {
  const router = useRouter()
  const { temporada } = useTemporada()
  const puedeEscribir = usePuedeEscribir(ITEM_SOLICITUD_PAGO)
  const [q, setQ] = useState('')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [selCtx, setSelCtx] = useState<{ productorId: number; moneda: string } | null>(null)

  const temporadaId = temporada?.id ?? null
  const { data, isPending } = useQuery({
    queryKey: solicitudesPagoKeys.pendientes(temporadaId ?? 0),
    queryFn: () => solicitudesPagoService.pendientes({ temporadaId: temporadaId! }),
    enabled: temporadaId != null,
  })

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (data?.data ?? [])
      .flatMap((g) =>
        g.cuotas
          .filter((c) => c.saldo > 0.005)
          .map((c) => ({ g, c, k: claveCuota(g.ordenCompra.id, g.embarque.id, c.ordenCompraCuotaPagoId) })),
      )
      .filter(
        ({ g }) =>
          !t ||
          g.productor.razonSocial.toLowerCase().includes(t) ||
          g.ordenCompra.numero.toLowerCase().includes(t) ||
          g.embarque.numeroInstructivo.toLowerCase().includes(t),
      )
  }, [data, q])

  function toggle(k: string, productorId: number, moneda: string, marcado: boolean) {
    const next = new Set(seleccion)
    if (marcado) next.add(k)
    else next.delete(k)
    setSeleccion(next)
    setSelCtx(next.size === 0 ? null : (selCtx ?? { productorId, moneda }))
  }

  const totales = useMemo(() => {
    const porMoneda = new Map<string, number>()
    for (const { g, c } of filas) {
      if (c.bloqueada) continue
      const m = g.ordenCompra.moneda.codigo
      porMoneda.set(m, (porMoneda.get(m) ?? 0) + c.saldo)
    }
    return [...porMoneda.entries()]
  }, [filas])
  const totalSeleccion = filas.filter((f) => seleccion.has(f.k)).reduce((a, f) => a + f.c.saldo, 0)

  function solicitar() {
    if (!selCtx) return
    const sp = new URLSearchParams({ productor: String(selCtx.productorId), cuotas: [...seleccion].join(',') })
    router.push(`/dashboard/productores/pagos/nueva?${sp.toString()}`)
  }

  if (!temporada) return <AvisoSinTemporada mostrar />

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Buscar</label>
          <Input placeholder='Productor, OC o embarque…' value={q} onChange={(e) => setQ(e.target.value)} className='w-64' />
        </div>
        {puedeEscribir && (
          <div className='flex items-center gap-3'>
            {selCtx && (
              <span className='text-muted-foreground text-sm tabular-nums'>
                {seleccion.size} cuota(s) · {selCtx.moneda} {formatMonto(totalSeleccion)}
              </span>
            )}
            <Button disabled={seleccion.size === 0} onClick={solicitar}>
              <Icons.add className='mr-1 h-4 w-4' /> Solicitar pago
            </Button>
          </div>
        )}
      </div>

      {isPending ? (
        <p className='text-muted-foreground text-sm'>Cargando...</p>
      ) : filas.length === 0 ? (
        <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
          No hay cuotas pendientes de pago en la temporada {temporada.descripcion}.
        </p>
      ) : (
        <>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  {puedeEscribir && <TableHead className='w-10' />}
                  <TableHead>Productor</TableHead>
                  <TableHead>OC</TableHead>
                  <TableHead>Embarque</TableHead>
                  <TableHead>Zarpe</TableHead>
                  <TableHead>Cuota</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className='text-right'>Monto cuota</TableHead>
                  <TableHead className='text-right'>Ya solicitado</TableHead>
                  <TableHead className='text-right'>Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map(({ g, c, k }) => {
                  const moneda = g.ordenCompra.moneda.codigo
                  const otroGrupo = selCtx != null && (selCtx.productorId !== g.productor.id || selCtx.moneda !== moneda)
                  return (
                    <TableRow key={k}>
                      {puedeEscribir && (
                        <TableCell>
                          <Checkbox
                            checked={seleccion.has(k)}
                            disabled={c.bloqueada || otroGrupo}
                            onCheckedChange={(v) => toggle(k, g.productor.id, moneda, !!v)}
                            title={otroGrupo ? 'Una solicitud es de un solo productor y una sola moneda' : undefined}
                          />
                        </TableCell>
                      )}
                      <TableCell>{g.productor.razonSocial}</TableCell>
                      <TableCell className='font-mono text-sm'>{g.ordenCompra.numero}</TableCell>
                      <TableCell className='font-mono text-sm'>{g.embarque.numeroInstructivo}</TableCell>
                      <TableCell className='text-muted-foreground'>{g.embarque.fechaZarpe ? formatFechaCorta(g.embarque.fechaZarpe) : '—'}</TableCell>
                      <TableCell className='text-sm'>
                        {c.numeroCuota} · {c.descripcion}
                        <span className='text-muted-foreground'> ({c.plazoDias} días {REFERENCIA_LABELS[c.fechaReferencia] ?? ''})</span>
                      </TableCell>
                      <TableCell className='text-sm'>{c.fechaVencimiento ? formatFechaCorta(c.fechaVencimiento) : '—'}</TableCell>
                      <TableCell className='text-right tabular-nums'>{moneda} {formatMonto(c.montoCalculado)}</TableCell>
                      <TableCell className='text-right tabular-nums'>{formatMonto(c.solicitado)}</TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {c.bloqueada ? (
                          <Badge variant='outline' title={g.bloqueos.join(' · ')}>Precio pendiente</Badge>
                        ) : (
                          formatMonto(c.saldo)
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <p className='text-muted-foreground text-sm'>
            {filas.length} cuota(s) pendiente(s)
            {totales.map(([m, t]) => ` · ${m} ${formatMonto(t)}`).join('')}
          </p>
        </>
      )}
    </div>
  )
}
