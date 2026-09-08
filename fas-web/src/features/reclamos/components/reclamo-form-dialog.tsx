'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { reclamosService } from '../service'
import { reclamosKeys } from '../queries'
import { LineasSelector, type SeleccionLineas } from './lineas-selector'
import { ProvisionForm } from './provision-form'
import type { PalletReclamable, ProvisionInput, Reclamo } from '../types'

interface ReclamoFormDialogProps {
  embarqueId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  // IMP-QA-R1-019: si viene, el diálogo edita este reclamo en vez de crear
  // uno nuevo (sin Provisión — esa se administra aparte, desde el detalle).
  reclamoParaEditar?: Reclamo
}

const PROVISION_VACIA: ProvisionInput = { tipoCalculo: 'POR_UNIDAD_CAJA' }

export function ReclamoFormDialog({ embarqueId, open, onOpenChange, reclamoParaEditar }: ReclamoFormDialogProps) {
  const queryClient = useQueryClient()
  const esEdicion = !!reclamoParaEditar
  // IMP-QA-R2-024: la Provisión inline exige el mismo permiso específico
  // que el endpoint dedicado — si no lo tiene, ni se le ofrece la opción.
  const puedeProvisionar = usePuedeEscribir('RECLAMO_PROVISION')
  const [fechaReclamo, setFechaReclamo] = useState('')
  const [resumenCliente, setResumenCliente] = useState('')
  const [seleccion, setSeleccion] = useState<SeleccionLineas>(new Map())
  const [conProvision, setConProvision] = useState(false)
  const [provision, setProvision] = useState<ProvisionInput>(PROVISION_VACIA)

  const { data, isPending } = useQuery({
    queryKey: ['reclamos', 'lineas-reclamables', embarqueId],
    queryFn: () => reclamosService.lineasReclamables(embarqueId),
    enabled: open,
    staleTime: 10_000,
  })

  // IMP-QA-R1-019: al editar, "disponible" viene calculado excluyendo TODOS
  // los reclamos (incluido este) — hay que devolverle a este reclamo sus
  // propias cajas ya reclamadas antes de mostrar el selector, si no
  // parecería que no queda nada disponible para lo que él mismo ya tiene.
  const pallets: PalletReclamable[] = useMemo(() => {
    const base = data?.data.pallets ?? []
    if (!reclamoParaEditar) return base
    const propias = new Map(reclamoParaEditar.lineas.map((l) => [l.palletLineaId, l.cantidadCajas]))
    return base.map((p) => ({
      ...p,
      lineas: p.lineas.map((l) => ({ ...l, cajasDisponibles: l.cajasDisponibles + (propias.get(l.id) ?? 0) })),
    }))
  }, [data, reclamoParaEditar])

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFechaReclamo(reclamoParaEditar?.fechaReclamo ?? '')
    setResumenCliente(reclamoParaEditar?.resumenCliente ?? '')
    setSeleccion(new Map(reclamoParaEditar?.lineas.map((l) => [l.palletLineaId, l.cantidadCajas]) ?? []))
    setConProvision(false)
    setProvision(PROVISION_VACIA)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reclamoParaEditar?.id])

  const totalCajas = [...seleccion.values()].reduce((a, b) => a + b, 0)

  const mutation = useMutation({
    mutationFn: () => {
      const lineas = [...seleccion.entries()].map(([palletLineaId, cantidadCajas]) => ({ palletLineaId, cantidadCajas }))
      if (esEdicion) {
        return reclamosService.actualizar(embarqueId, reclamoParaEditar!.id, {
          fechaReclamo: fechaReclamo || null,
          resumenCliente: resumenCliente.trim() || null,
          lineas,
        })
      }
      return reclamosService.crear(embarqueId, {
        fechaReclamo: fechaReclamo || null,
        resumenCliente: resumenCliente.trim() || null,
        lineas,
        provision: conProvision ? provision : null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reclamosKeys.porEmbarque(embarqueId) })
      if (esEdicion) queryClient.invalidateQueries({ queryKey: reclamosKeys.detail(reclamoParaEditar!.id) })
      toast.success(esEdicion ? 'Reclamo actualizado' : 'Reclamo creado')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || `Error al ${esEdicion ? 'actualizar' : 'crear'} el reclamo`),
  })

  function handleSubmit() {
    if (totalCajas === 0) {
      toast.error('Selecciona al menos una línea de pallet')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90vh] w-full flex-col overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{esEdicion ? 'Editar Reclamo' : 'Nuevo Reclamo'}</DialogTitle>
          <DialogDescription>
            Marca los pallets/líneas afectados de este Embarque
            {!esEdicion && ' y, si corresponde, deja una Provisión inicial'}.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          {data && (
            <p className='text-muted-foreground text-sm'>
              Cliente: <span className='text-foreground font-medium'>{data.data.cliente.descripcion}</span> · Moneda:{' '}
              <span className='text-foreground font-medium'>{data.data.moneda.codigo}</span> (heredados del Embarque)
            </p>
          )}

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Fecha del reclamo del cliente</Label>
              <Input type='date' value={fechaReclamo} onChange={(e) => setFechaReclamo(e.target.value)} />
            </div>
          </div>
          <div className='space-y-1.5'>
            <Label>Resumen del cliente</Label>
            <Textarea value={resumenCliente} onChange={(e) => setResumenCliente(e.target.value)} rows={2} />
          </div>

          <div className='space-y-1.5'>
            <Label>Fruta reclamada</Label>
            {isPending ? (
              <p className='text-muted-foreground text-sm'>Cargando pallets del Embarque...</p>
            ) : (
              <LineasSelector pallets={pallets} value={seleccion} onChange={setSeleccion} />
            )}
          </div>

          {!esEdicion && puedeProvisionar && (
            <>
              <div className='flex items-center gap-2'>
                <Switch id='con-provision' checked={conProvision} onCheckedChange={setConProvision} />
                <Label htmlFor='con-provision'>Agregar Provisión inicial</Label>
              </div>
              {conProvision && <ProvisionForm value={provision} onChange={setProvision} cajasDisponibles={totalCajas} />}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {esEdicion ? 'Guardar cambios' : 'Crear Reclamo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
