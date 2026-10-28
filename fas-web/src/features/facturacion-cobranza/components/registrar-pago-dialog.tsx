'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatMonto } from '@/lib/format'
import { cobranzaService, hoyFecha } from '../service'
import { documentosPendientesOptions, monedasOptions, cobranzaKeys } from '../queries'
import type { DocumentoPendiente, MedioPago } from '../types'

const MEDIOS: { value: MedioPago; label: string }[] = [
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'OTRO', label: 'Otro' },
]

const num = (s: string) => {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number) => Math.round(n * 100) / 100
const claveDoc = (d: { tipoFactura: string; id: number }) => `${d.tipoFactura}:${d.id}`

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  clienteId: number
  clienteNombre: string
}

interface LineaSeleccion {
  montoAplicado: string
  tipoCambio: string
}

export function RegistrarPagoDialog({ open, onOpenChange, clienteId, clienteNombre }: Props) {
  const queryClient = useQueryClient()
  const [fecha, setFecha] = useState(hoyFecha())
  const [monedaId, setMonedaId] = useState<string>('')
  const [monto, setMonto] = useState('')
  const [medioPago, setMedioPago] = useState<MedioPago>('TRANSFERENCIA')
  const [referencia, setReferencia] = useState('')
  const [observacion, setObservacion] = useState('')
  const [seleccion, setSeleccion] = useState<Record<string, LineaSeleccion>>({})

  const { data: monedas } = useQuery({ ...monedasOptions(), enabled: open })
  const { data: docsResp } = useQuery({ ...documentosPendientesOptions(clienteId), enabled: open && clienteId > 0 })
  const documentos = docsResp?.data ?? []

  const montoNum = num(monto)
  const monedaPagoId = monedaId ? Number(monedaId) : null

  // Consumido del pago (en su moneda) = Σ montoAplicado / tipoCambio.
  const consumido = useMemo(() => {
    let total = 0
    for (const [, l] of Object.entries(seleccion)) {
      const m = num(l.montoAplicado)
      const tc = num(l.tipoCambio) || 1
      if (m > 0 && tc > 0) total += m / tc
    }
    return round2(total)
  }, [seleccion])
  const remanente = round2(montoNum - consumido)

  function resetear() {
    setFecha(hoyFecha())
    setMonedaId('')
    setMonto('')
    setMedioPago('TRANSFERENCIA')
    setReferencia('')
    setObservacion('')
    setSeleccion({})
  }

  function manejarOpenChange(next: boolean) {
    if (!next) resetear()
    onOpenChange(next)
  }

  function toggleDoc(doc: DocumentoPendiente) {
    const clave = claveDoc(doc)
    setSeleccion((prev) => {
      const copia = { ...prev }
      if (copia[clave]) {
        delete copia[clave]
      } else {
        const mismaMoneda = monedaPagoId === doc.moneda.id
        copia[clave] = { montoAplicado: String(doc.saldoPendiente), tipoCambio: mismaMoneda ? '1' : '' }
      }
      return copia
    })
  }

  function setCampo(clave: string, campo: keyof LineaSeleccion, valor: string) {
    setSeleccion((prev) => ({ ...prev, [clave]: { ...prev[clave], [campo]: valor } }))
  }

  const mutation = useMutation({
    mutationFn: () => {
      const aplicaciones = Object.entries(seleccion).map(([clave, l]) => {
        const [tipoFactura, idStr] = clave.split(':')
        const doc = documentos.find((d) => claveDoc(d) === clave)!
        const mismaMoneda = monedaPagoId === doc.moneda.id
        return {
          tipoFactura: tipoFactura as 'EXPORTACION' | 'NACIONAL',
          facturaId: Number(idStr),
          montoAplicado: num(l.montoAplicado),
          tipoCambio: mismaMoneda ? 1 : num(l.tipoCambio),
        }
      })
      return cobranzaService.crearPago({
        clienteId,
        fecha,
        monto: montoNum,
        monedaId: monedaPagoId!,
        medioPago,
        referencia: referencia.trim() || null,
        observacion: observacion.trim() || null,
        aplicaciones,
      })
    },
    onSuccess: () => {
      toast.success('Pago registrado')
      queryClient.invalidateQueries({ queryKey: cobranzaKeys.all })
      manejarOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo registrar el pago'),
  })

  // Validación en vivo para habilitar el botón.
  const errores: string[] = []
  if (!monedaPagoId) errores.push('Selecciona la moneda del pago')
  if (montoNum <= 0) errores.push('Ingresa el monto del pago')
  for (const [clave, l] of Object.entries(seleccion)) {
    const doc = documentos.find((d) => claveDoc(d) === clave)
    if (!doc) continue
    const m = num(l.montoAplicado)
    if (m <= 0) errores.push(`Monto inválido en ${doc.codigo}`)
    if (m > doc.saldoPendiente + 0.005) errores.push(`${doc.codigo}: excede su saldo`)
    if (monedaPagoId !== doc.moneda.id && num(l.tipoCambio) <= 0) errores.push(`${doc.codigo}: falta tipo de cambio`)
  }
  if (consumido > montoNum + 0.005) errores.push('Las aplicaciones superan el monto del pago')
  const puedeGuardar = errores.length === 0 && !mutation.isPending

  return (
    <Dialog open={open} onOpenChange={manejarOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <DialogDescription>{clienteNombre}</DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
            <div className='space-y-1.5'>
              <Label>Fecha</Label>
              <Input type='date' value={fecha} onChange={(e) => setFecha(e.target.value)} className='h-9' />
            </div>
            <div className='space-y-1.5'>
              <Label>Moneda</Label>
              <Select value={monedaId} onValueChange={(v) => { setMonedaId(v); setSeleccion({}) }}>
                <SelectTrigger className='h-9'>
                  <SelectValue placeholder='Moneda' />
                </SelectTrigger>
                <SelectContent>
                  {(monedas ?? []).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.codigo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Monto</Label>
              <Input type='number' value={monto} onChange={(e) => setMonto(e.target.value)} placeholder='0' className='h-9 text-right tabular-nums' />
            </div>
            <div className='space-y-1.5'>
              <Label>Medio</Label>
              <Select value={medioPago} onValueChange={(v) => setMedioPago(v as MedioPago)}>
                <SelectTrigger className='h-9'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEDIOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label>Referencia</Label>
              <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder='N° transferencia, cheque...' className='h-9' />
            </div>
            <div className='space-y-1.5'>
              <Label>Observación</Label>
              <Textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={1} />
            </div>
          </div>

          <div className='space-y-2'>
            <Label className='text-[10.5px] tracking-wide uppercase'>Facturas pendientes</Label>
            {documentos.length === 0 ? (
              <p className='text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm'>
                Este cliente no tiene facturas con saldo pendiente.
              </p>
            ) : (
              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-10'></TableHead>
                      <TableHead>Factura</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead className='text-right'>Saldo</TableHead>
                      <TableHead className='text-right'>A aplicar</TableHead>
                      <TableHead className='text-right'>T/C</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentos.map((doc) => {
                      const clave = claveDoc(doc)
                      const sel = seleccion[clave]
                      const mismaMoneda = monedaPagoId === doc.moneda.id
                      return (
                        <TableRow key={clave}>
                          <TableCell>
                            <input type='checkbox' checked={!!sel} onChange={() => toggleDoc(doc)} className='h-4 w-4' />
                          </TableCell>
                          <TableCell className='font-medium'>{doc.codigo}</TableCell>
                          <TableCell>
                            <Badge variant='outline'>{doc.tipoFactura === 'EXPORTACION' ? 'Export' : 'Nacional'}</Badge>
                          </TableCell>
                          <TableCell>{doc.moneda.codigo}</TableCell>
                          <TableCell className='text-right tabular-nums'>{formatMonto(doc.saldoPendiente)}</TableCell>
                          <TableCell className='text-right'>
                            <Input
                              type='number'
                              value={sel?.montoAplicado ?? ''}
                              disabled={!sel}
                              onChange={(e) => setCampo(clave, 'montoAplicado', e.target.value)}
                              className='h-8 w-28 text-right tabular-nums'
                            />
                          </TableCell>
                          <TableCell className='text-right'>
                            <Input
                              type='number'
                              value={mismaMoneda ? '1' : (sel?.tipoCambio ?? '')}
                              disabled={!sel || mismaMoneda}
                              onChange={(e) => setCampo(clave, 'tipoCambio', e.target.value)}
                              className='h-8 w-24 text-right tabular-nums'
                              placeholder='T/C'
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className='flex flex-wrap justify-end gap-x-6 gap-y-1 rounded-md bg-muted/40 px-4 py-2 text-sm'>
            <span className='text-muted-foreground'>Consumido: <span className='tabular-nums text-foreground'>{formatMonto(consumido)}</span></span>
            <span className='text-muted-foreground'>
              {remanente > 0.005 ? 'Quedará a favor: ' : 'Remanente: '}
              <span className='tabular-nums text-foreground'>{formatMonto(remanente < 0 ? 0 : remanente)}</span>
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => manejarOpenChange(false)}>Cancelar</Button>
          <Button disabled={!puedeGuardar} isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            Registrar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
