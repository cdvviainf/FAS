'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { formatFechaCorta, formatMonto } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import {
  clientesOptions,
  documentosPendientesOptions,
  pagosListOptions,
  saldosAFavorOptions,
} from '../queries'
import type { EstadoCobranza, SaldoAFavor } from '../types'
import { RegistrarPagoDialog } from './registrar-pago-dialog'
import { AplicarSaldoDialog } from './aplicar-saldo-dialog'

const ITEM = 'VENTAS_COBRANZA'

const ESTADO_BADGE: Record<EstadoCobranza, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  SIN_CUOTAS: { label: 'Sin cuotas', variant: 'secondary' },
  PENDIENTE: { label: 'Pendiente', variant: 'outline' },
  PARCIAL: { label: 'Parcial', variant: 'default' },
  PAGADA: { label: 'Pagada', variant: 'default' },
  VENCIDA: { label: 'Vencida', variant: 'destructive' },
}

const MEDIO_LABEL: Record<string, string> = {
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  EFECTIVO: 'Efectivo',
  OTRO: 'Otro',
}

export function CobranzaClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [clienteId, setClienteId] = useState<number>(0)
  const [pagoOpen, setPagoOpen] = useState(false)
  const [saldoAAplicar, setSaldoAAplicar] = useState<SaldoAFavor | null>(null)

  const { data: clientes } = useQuery(clientesOptions())
  const opcionesCliente = useMemo(
    () => (clientes ?? []).map((c) => ({ value: String(c.id), label: `${c.razonSocial || c.descripcion} (${c.codigo})` })),
    [clientes],
  )
  const clienteNombre = useMemo(() => {
    const c = (clientes ?? []).find((x) => x.id === clienteId)
    return c ? c.razonSocial || c.descripcion : ''
  }, [clientes, clienteId])

  const { data: docsResp, isPending: docsLoading } = useQuery(documentosPendientesOptions(clienteId))
  const { data: saldosResp } = useQuery(saldosAFavorOptions(clienteId))
  const { data: pagosResp } = useQuery(pagosListOptions({ clienteId, page: 1, limit: 50 }))

  const documentos = docsResp?.data ?? []
  const saldos = saldosResp?.data ?? []
  const pagos = pagosResp?.data ?? []

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div className='min-w-[320px] space-y-1.5'>
          <Label className='text-[10.5px] tracking-wide uppercase'>Cliente</Label>
          <Combobox
            options={opcionesCliente}
            value={clienteId ? String(clienteId) : null}
            onChange={(v) => setClienteId(Number(v))}
            placeholder='Selecciona un cliente'
            searchPlaceholder='Buscar cliente...'
            emptyText='Sin clientes.'
          />
        </div>
        {puedeEscribir && clienteId > 0 && (
          <Button onClick={() => setPagoOpen(true)}>
            <Icons.billing className='mr-1 h-4 w-4' />
            Registrar Pago
          </Button>
        )}
      </div>

      {clienteId === 0 ? (
        <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
          Selecciona un cliente para ver su cartera, saldos a favor y pagos.
        </p>
      ) : (
        <Tabs defaultValue='cartera' className='space-y-3'>
          <TabsList>
            <TabsTrigger value='cartera'>Cartera</TabsTrigger>
            <TabsTrigger value='saldos'>Saldo a Favor {saldos.length > 0 ? `(${saldos.length})` : ''}</TabsTrigger>
            <TabsTrigger value='pagos'>Pagos {pagos.length > 0 ? `(${pagos.length})` : ''}</TabsTrigger>
          </TabsList>

          {/* ─── Cartera ─── */}
          <TabsContent value='cartera'>
            {docsLoading ? (
              <p className='text-muted-foreground text-sm'>Cargando...</p>
            ) : documentos.length === 0 ? (
              <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
                Sin facturas con saldo pendiente.
              </p>
            ) : (
              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Factura</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead>Emisión</TableHead>
                      <TableHead className='text-right'>Total</TableHead>
                      <TableHead className='text-right'>Saldo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentos.map((doc) => {
                      const badge = doc.estadoCobranza ? ESTADO_BADGE[doc.estadoCobranza] : null
                      return (
                        <TableRow key={`${doc.tipoFactura}:${doc.id}`}>
                          <TableCell className='font-medium'>{doc.codigo}</TableCell>
                          <TableCell><Badge variant='outline'>{doc.tipoFactura === 'EXPORTACION' ? 'Export' : 'Nacional'}</Badge></TableCell>
                          <TableCell>{doc.moneda.codigo}</TableCell>
                          <TableCell className='text-muted-foreground'>{doc.fechaEmision ? formatFechaCorta(doc.fechaEmision) : '—'}</TableCell>
                          <TableCell className='text-right tabular-nums'>{formatMonto(doc.montoTotal)}</TableCell>
                          <TableCell className='text-right font-medium tabular-nums'>{formatMonto(doc.saldoPendiente)}</TableCell>
                          <TableCell>{badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : '—'}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ─── Saldo a favor ─── */}
          <TabsContent value='saldos'>
            {saldos.length === 0 ? (
              <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
                Sin saldos a favor disponibles.
              </p>
            ) : (
              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead className='text-right'>Original</TableHead>
                      <TableHead className='text-right'>Disponible</TableHead>
                      <TableHead className='text-right'>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saldos.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className='text-muted-foreground'>{formatFechaCorta(s.fecha)}</TableCell>
                        <TableCell>{s.pagoOrigen ? s.pagoOrigen.codigo : '—'}</TableCell>
                        <TableCell>{s.moneda.codigo}</TableCell>
                        <TableCell className='text-right tabular-nums'>{formatMonto(s.montoOriginal)}</TableCell>
                        <TableCell className='text-right font-medium tabular-nums'>{formatMonto(s.montoDisponible)}</TableCell>
                        <TableCell className='text-right'>
                          {puedeEscribir && (
                            <Button variant='outline' size='sm' onClick={() => setSaldoAAplicar(s)}>Aplicar</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ─── Pagos ─── */}
          <TabsContent value='pagos'>
            {pagos.length === 0 ? (
              <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
                Sin pagos registrados.
              </p>
            ) : (
              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pago</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Medio</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead className='text-right'>Monto</TableHead>
                      <TableHead>Aplicado a</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className='font-medium'>{p.codigo}</TableCell>
                        <TableCell className='text-muted-foreground'>{formatFechaCorta(p.fecha)}</TableCell>
                        <TableCell>{MEDIO_LABEL[p.medioPago] ?? p.medioPago}</TableCell>
                        <TableCell>{p.moneda.codigo}</TableCell>
                        <TableCell className='text-right tabular-nums'>{formatMonto(p.monto)}</TableCell>
                        <TableCell className='text-muted-foreground text-xs'>
                          {p.aplicaciones.length === 0
                            ? (p.saldoAFavorGenerado ? 'Saldo a favor' : '—')
                            : p.aplicaciones
                                .map((a) => a.facturaExportacion?.codigo ?? a.facturaNacional?.codigo ?? '—')
                                .join(', ')}
                          {p.saldoAFavorGenerado && p.aplicaciones.length > 0 ? ' + saldo a favor' : ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {clienteId > 0 && (
        <RegistrarPagoDialog open={pagoOpen} onOpenChange={setPagoOpen} clienteId={clienteId} clienteNombre={clienteNombre} />
      )}
      <AplicarSaldoDialog
        open={!!saldoAAplicar}
        onOpenChange={(o) => { if (!o) setSaldoAAplicar(null) }}
        clienteId={clienteId}
        saldo={saldoAAplicar}
      />
    </div>
  )
}
