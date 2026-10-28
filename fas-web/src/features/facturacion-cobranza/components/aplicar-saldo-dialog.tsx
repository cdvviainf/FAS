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
import { Combobox } from '@/components/ui/combobox'
import { formatMonto } from '@/lib/format'
import { cobranzaService } from '../service'
import { documentosPendientesOptions, cobranzaKeys } from '../queries'
import type { SaldoAFavor } from '../types'

const num = (s: string) => {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  clienteId: number
  saldo: SaldoAFavor | null
}

export function AplicarSaldoDialog({ open, onOpenChange, clienteId, saldo }: Props) {
  const queryClient = useQueryClient()
  const [facturaClave, setFacturaClave] = useState<string | null>(null)
  const [monto, setMonto] = useState('')

  // Facturas pendientes del cliente EN LA MONEDA del saldo (CB13).
  const { data: docsResp } = useQuery({
    ...documentosPendientesOptions(clienteId, saldo?.moneda.id),
    enabled: open && clienteId > 0 && !!saldo,
  })
  const documentos = useMemo(() => docsResp?.data ?? [], [docsResp])

  const opciones = useMemo(
    () =>
      documentos.map((d) => ({
        value: `${d.tipoFactura}:${d.id}`,
        label: `${d.codigo} · saldo ${formatMonto(d.saldoPendiente)} ${d.moneda.codigo}`,
      })),
    [documentos],
  )

  const facturaSel = documentos.find((d) => `${d.tipoFactura}:${d.id}` === facturaClave) ?? null
  const disponible = saldo ? Number(saldo.montoDisponible) : 0
  const topeFactura = facturaSel?.saldoPendiente ?? 0
  const tope = Math.min(disponible, topeFactura)

  function manejarOpenChange(next: boolean) {
    if (!next) {
      setFacturaClave(null)
      setMonto('')
    }
    onOpenChange(next)
  }

  const mutation = useMutation({
    mutationFn: () => {
      const [tipoFactura, idStr] = facturaClave!.split(':')
      return cobranzaService.aplicarSaldo(saldo!.id, {
        tipoFactura: tipoFactura as 'EXPORTACION' | 'NACIONAL',
        facturaId: Number(idStr),
        monto: num(monto),
      })
    },
    onSuccess: () => {
      toast.success('Saldo a favor aplicado')
      queryClient.invalidateQueries({ queryKey: cobranzaKeys.all })
      manejarOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo aplicar el saldo a favor'),
  })

  const montoNum = num(monto)
  const puede = !!saldo && !!facturaSel && montoNum > 0 && montoNum <= tope + 0.005 && !mutation.isPending

  return (
    <Dialog open={open} onOpenChange={manejarOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Aplicar Saldo a Favor</DialogTitle>
          <DialogDescription>
            {saldo
              ? `Disponible: ${formatMonto(saldo.montoDisponible)} ${saldo.moneda.codigo}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-1.5'>
            <Label>Factura destino</Label>
            <Combobox
              options={opciones}
              value={facturaClave}
              onChange={(v) => {
                setFacturaClave(v)
                const doc = documentos.find((d) => `${d.tipoFactura}:${d.id}` === v)
                if (doc) setMonto(String(Math.min(disponible, doc.saldoPendiente)))
              }}
              placeholder='Selecciona una factura'
              emptyText='Sin facturas pendientes en esta moneda.'
            />
          </div>
          <div className='space-y-1.5'>
            <Label>Monto a aplicar</Label>
            <Input
              type='number'
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className='h-9 text-right tabular-nums'
              placeholder='0'
            />
            {facturaSel && (
              <p className='text-muted-foreground text-xs'>Máximo aplicable: {formatMonto(tope)} {saldo?.moneda.codigo}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => manejarOpenChange(false)}>Cancelar</Button>
          <Button disabled={!puede} isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
