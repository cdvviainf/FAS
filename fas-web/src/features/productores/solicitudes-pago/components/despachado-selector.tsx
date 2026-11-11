'use client'

import { Fragment, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatFechaCorta, formatMonto } from '@/lib/format'
import type { GrupoDespachado } from '../types'

const REFERENCIA_LABELS: Record<string, string> = {
  FACTURA: 'desde factura',
  ZARPE: 'desde zarpe',
  ENVIO_DOCUMENTOS: 'desde envío de documentos',
  ARRIBO: 'desde arribo',
}

export function claveCuota(ordenCompraId: number, embarqueId: number, cuotaId: number | null): string {
  return `${ordenCompraId}|${embarqueId}|${cuotaId ?? 'total'}`
}

// Lo despachado por OC × Embarque (Embarques con despacho confirmado) con el
// detalle de pallets valorizados y las cuotas de la condición de pago de la OC.
// `seleccion`: clave de cuota → monto a solicitar (texto del input).
export function DespachadoSelector({
  grupos,
  seleccion,
  onChange,
  disabled,
}: {
  grupos: GrupoDespachado[]
  seleccion: Record<string, string>
  onChange: (next: Record<string, string>) => void
  disabled?: boolean
}) {
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})

  if (grupos.length === 0) {
    return (
      <p className='text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm'>
        Este productor no tiene fruta despachada (Embarques con despacho confirmado) asociada a sus OC.
      </p>
    )
  }

  function toggle(k: string, marcado: boolean, saldo: number) {
    const next = { ...seleccion }
    if (marcado) next[k] = String(saldo)
    else delete next[k]
    onChange(next)
  }

  return (
    <div className='space-y-4'>
      {grupos.map((g) => {
        const kg = `${g.ordenCompra.id}|${g.embarque.id}`
        const moneda = g.ordenCompra.moneda.codigo
        return (
          <div key={kg} className='space-y-3 rounded-md border p-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='text-sm'>
                <span className='font-medium'>{g.ordenCompra.numero}</span>
                <span className='text-muted-foreground'> · Embarque {g.embarque.numeroInstructivo}</span>
                {g.embarque.fechaZarpe && <span className='text-muted-foreground'> · Zarpe {formatFechaCorta(g.embarque.fechaZarpe)}</span>}
                {g.ordenCompra.condicionPago && <span className='text-muted-foreground'> · {g.ordenCompra.condicionPago.descripcion}</span>}
              </div>
              <div className='text-sm tabular-nums'>
                {g.pallets} pallet(s) · {formatMonto(g.cajas, 0)} cajas · <span className='font-medium'>{moneda} {formatMonto(g.monto)}</span>
              </div>
            </div>

            {g.bloqueos.length > 0 && (
              <div className='rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200'>
                {g.bloqueos.map((b, i) => <p key={i}>{b}</p>)}
              </div>
            )}

            <Button type='button' variant='ghost' size='sm' onClick={() => setAbiertos((a) => ({ ...a, [kg]: !a[kg] }))}>
              {abiertos[kg] ? 'Ocultar' : 'Ver'} detalle de pallets
            </Button>
            {abiertos[kg] && (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pallet</TableHead>
                      <TableHead>Variedad</TableHead>
                      <TableHead>Calibre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Embalaje</TableHead>
                      <TableHead>Etiqueta</TableHead>
                      <TableHead className='text-right'>Cajas</TableHead>
                      <TableHead className='text-right'>Precio OC</TableHead>
                      <TableHead className='text-right'>Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.detalle.map((d, i) => (
                      <TableRow key={i} className={d.pendiente ? 'bg-amber-50 dark:bg-amber-950/40' : undefined}>
                        <TableCell className='font-mono text-xs'>{d.numeroPallet}</TableCell>
                        <TableCell className='text-sm'>{d.variedad}</TableCell>
                        <TableCell className='text-sm'>{d.calibre}</TableCell>
                        <TableCell className='text-sm'>{d.categoria}</TableCell>
                        <TableCell className='text-sm'>{d.embalaje}</TableCell>
                        <TableCell className='text-sm'>{d.etiqueta ?? '—'}</TableCell>
                        <TableCell className='text-right tabular-nums'>{formatMonto(d.cajas, 0)}</TableCell>
                        <TableCell className='text-right tabular-nums'>
                          {d.precio != null ? formatMonto(d.precio, 4) : <span className='text-xs text-amber-700'>{d.pendiente}</span>}
                        </TableCell>
                        <TableCell className='text-right tabular-nums'>{formatMonto(d.monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-10' />
                  <TableHead>Cuota</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className='text-right'>Monto cuota</TableHead>
                  <TableHead className='text-right'>Ya solicitado</TableHead>
                  <TableHead className='text-right'>Saldo</TableHead>
                  <TableHead className='w-40 text-right'>A solicitar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.cuotas.map((c) => {
                  const k = claveCuota(g.ordenCompra.id, g.embarque.id, c.ordenCompraCuotaPagoId)
                  const seleccionada = k in seleccion
                  const sinSaldo = c.saldo <= 0 && !seleccionada
                  return (
                    <Fragment key={k}>
                      <TableRow>
                        <TableCell>
                          <Checkbox
                            checked={seleccionada}
                            disabled={disabled || c.bloqueada || sinSaldo}
                            onCheckedChange={(v) => toggle(k, !!v, c.saldo)}
                          />
                        </TableCell>
                        <TableCell className='text-sm'>
                          {c.numeroCuota} · {c.descripcion}
                          <span className='text-muted-foreground'> ({c.plazoDias} días {REFERENCIA_LABELS[c.fechaReferencia] ?? ''})</span>
                        </TableCell>
                        <TableCell className='text-sm'>{c.fechaVencimiento ? formatFechaCorta(c.fechaVencimiento) : '—'}</TableCell>
                        <TableCell className='text-right tabular-nums'>{formatMonto(c.montoCalculado)}</TableCell>
                        <TableCell className='text-right tabular-nums'>{formatMonto(c.solicitado)}</TableCell>
                        <TableCell className='text-right tabular-nums'>
                          {c.bloqueada ? <Badge variant='outline'>Precio pendiente</Badge> : formatMonto(c.saldo)}
                        </TableCell>
                        <TableCell>
                          {seleccionada && (
                            <Input
                              type='number'
                              min={0}
                              step='0.01'
                              value={seleccion[k]}
                              disabled={disabled}
                              onChange={(e) => onChange({ ...seleccion, [k]: e.target.value })}
                              className='h-8 text-right'
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )
      })}
    </div>
  )
}
