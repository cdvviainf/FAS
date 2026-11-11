'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMonto } from '@/lib/format'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { solicitudesPagoKeys, solicitudesPagoService } from '../service'
import type { SolicitudPago } from '../types'

const conceptosCtaCteService = createMantenedorService('conceptos-cta-cte')

function hoy(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// "Confirmar pago" (permiso aparte): fecha de pago, concepto de cta. cte., N° de
// transferencia opcional y N° de factura del productor por cuota. Genera un DEBE
// por cuota en la cuenta corriente del productor.
export function ConfirmarPagoDialog({ solicitud, open, onOpenChange }: { solicitud: SolicitudPago; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient()
  const [fechaPago, setFechaPago] = useState(hoy())
  const [conceptoId, setConceptoId] = useState('')
  const [transferencia, setTransferencia] = useState('')
  const [facturas, setFacturas] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio al abrir
    setFechaPago(hoy())
    setConceptoId('')
    setTransferencia('')
    setFacturas({})
  }, [open])

  const { data: conceptosData } = useQuery({
    queryKey: ['conceptos-cta-cte-options'],
    queryFn: () => conceptosCtaCteService.list({ soloActivos: true, limit: 500 }),
    staleTime: 5 * 60_000,
    enabled: open,
  })
  // El pago reduce lo que se le debe al productor → DEBE: solo conceptos DEBE o AMBOS.
  const conceptos = (conceptosData?.data ?? []).filter((c) => (c as { naturaleza?: string }).naturaleza !== 'HABER')
  const lineas = solicitud.lineas ?? []

  const confirmar = useMutation({
    mutationFn: () =>
      solicitudesPagoService.confirmarPago(solicitud.id, {
        fechaPago,
        conceptoCtaCteId: Number(conceptoId),
        numeroTransferencia: transferencia.trim() || null,
        facturas: lineas.map((l) => ({ lineaId: l.id, numeroFactura: (facturas[l.id] ?? '').trim() })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: solicitudesPagoKeys.all })
      toast.success('Pago confirmado y registrado en la cuenta corriente del productor')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al confirmar el pago'),
  })

  function handleConfirmar() {
    if (!fechaPago) return toast.error('Indica la fecha de pago')
    if (!conceptoId) return toast.error('Selecciona el concepto de cuenta corriente')
    if (lineas.some((l) => !(facturas[l.id] ?? '').trim())) return toast.error('Indica el N° de factura del productor en cada cuota')
    confirmar.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[760px]' onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Confirmar pago {solicitud.numero}</DialogTitle>
          <DialogDescription>
            Al confirmar se registra un DEBE por cada cuota en la cuenta corriente del productor, con el texto &quot;Pago factura N° …&quot;.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label>Fecha de pago <span className='text-destructive'>*</span></Label>
              <Input type='date' value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
            </div>
            <div className='space-y-1.5'>
              <Label>Concepto cta. cte. <span className='text-destructive'>*</span></Label>
              <Select value={conceptoId} onValueChange={setConceptoId}>
                <SelectTrigger><SelectValue placeholder='Selecciona...' /></SelectTrigger>
                <SelectContent>
                  {conceptos.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>N° transferencia</Label>
              <Input value={transferencia} maxLength={100} onChange={(e) => setTransferencia(e.target.value)} />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OC</TableHead>
                <TableHead>Embarque</TableHead>
                <TableHead>Cuota</TableHead>
                <TableHead className='text-right'>Monto</TableHead>
                <TableHead className='w-44'>N° factura productor *</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.ordenCompra.numero}</TableCell>
                  <TableCell>{l.embarque.numeroInstructivo}</TableCell>
                  <TableCell>{l.numeroCuota}</TableCell>
                  <TableCell className='text-right tabular-nums'>{solicitud.moneda.codigo} {formatMonto(l.montoSolicitado)}</TableCell>
                  <TableCell>
                    <Input
                      className='h-8'
                      maxLength={50}
                      value={facturas[l.id] ?? ''}
                      onChange={(e) => setFacturas((f) => ({ ...f, [l.id]: e.target.value }))}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={confirmar.isPending}>Cancelar</Button>
          <Button onClick={handleConfirmar} isLoading={confirmar.isPending}>Confirmar pago</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
