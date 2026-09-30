'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { embarquesService } from '../service'
import { embarquesKeys } from '../queries'
import { notasVentaKeys, notaVentaDetailOptions } from '@/features/ventas/notas-venta/queries'
import { entidadesService } from '@/features/entidades/service'
import type { DatosContenedorInput } from '../types'

const NINGUNO = '__NINGUNO__'
const tiposParametroService = createMantenedorService('tipos-parametro')
const parametrosService = createMantenedorService('parametros')

interface GenerarEmbarqueDialogProps {
  notaVentaId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Temperatura/CBM/Tipo de BL en edición (strings — igual criterio que
// reserva-info-base-card.tsx).
interface ContenedorForm {
  temperatura: string
  cbm: string
  tipoBlId: string
}

function contenedorVacio(tipoBlIdDefault: string): ContenedorForm {
  return { temperatura: '', cbm: '', tipoBlId: tipoBlIdDefault }
}

function aInput(c: ContenedorForm): DatosContenedorInput {
  return {
    temperatura: c.temperatura !== '' ? Math.trunc(Number(c.temperatura)) : null,
    cbm: c.cbm !== '' ? Math.trunc(Number(c.cbm)) : null,
    tipoBlId: c.tipoBlId !== NINGUNO ? Number(c.tipoBlId) : null,
  }
}

export function GenerarEmbarqueDialog({ notaVentaId, open, onOpenChange }: GenerarEmbarqueDialogProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [confirmarSinReservaOpen, setConfirmarSinReservaOpen] = useState(false)
  const [gestorLogisticoId, setGestorLogisticoId] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState<number>(1)

  // Información base por contenedor (2026-09-30): por defecto un solo bloque
  // "mismo valor para todos"; si se destilda, un bloque editable por
  // contenedor (1..cantidad).
  const [mismoParaTodos, setMismoParaTodos] = useState(true)
  const [contenedorComun, setContenedorComun] = useState<ContenedorForm>(contenedorVacio(NINGUNO))
  const [contenedoresIndividuales, setContenedoresIndividuales] = useState<ContenedorForm[]>([])

  // Tipo de BL por defecto: el del Cierre Comercial (propuesto, editable acá).
  const { data: notaVentaData } = useQuery({ ...notaVentaDetailOptions(notaVentaId), enabled: open })
  const tipoBlDefault = notaVentaData?.data.tipoBlId != null ? String(notaVentaData.data.tipoBlId) : NINGUNO

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- propone el default una sola vez al abrir
    setContenedorComun((c) => (c.tipoBlId === NINGUNO ? { ...c, tipoBlId: tipoBlDefault } : c))
  }, [open, tipoBlDefault])

  // Mantiene el arreglo "individual" del mismo largo que `cantidad`, sin
  // perder lo ya tipeado en las posiciones que siguen existiendo.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContenedoresIndividuales((prev) => {
      if (prev.length === cantidad) return prev
      const next = [...prev]
      while (next.length < cantidad) next.push(contenedorVacio(tipoBlDefault))
      next.length = cantidad
      return next
    })
  }, [cantidad, tipoBlDefault])

  const { data: tiposParam } = useQuery({
    queryKey: ['tipos-parametro-options'],
    queryFn: () => tiposParametroService.list({ limit: 200 }),
    staleTime: 5 * 60_000,
    enabled: open,
  })
  const tipoBlTipoId = tiposParam?.data.find((t) => t.codigo === 'TIPO_BL')?.id
  const { data: tiposBl } = useQuery({
    queryKey: ['parametros-options', tipoBlTipoId],
    queryFn: () => parametrosService.list({ limit: 200, tipoParametroId: tipoBlTipoId }),
    staleTime: 5 * 60_000,
    enabled: !!tipoBlTipoId && open,
  })

  // Sugerencia de contenedores = techo(pallets del Cierre / 20). Editable.
  const { data: estimacion } = useQuery({
    queryKey: ['embarque-estimacion-contenedores', notaVentaId],
    queryFn: () => embarquesService.estimacionContenedores(notaVentaId),
    enabled: open,
    staleTime: 30_000,
  })
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && estimacion?.data) setCantidad(estimacion.data.contenedoresSugeridos)
  }, [open, estimacion])

  // Gestor Logístico (2026-09-07, ventas.md §4.3) — generaliza AGL360: si el
  // gestor elegido tiene una Integración activa vinculada, se intenta la
  // reserva automática; si no, el Embarque nace directo en modo manual.
  const { data: gestoresData } = useQuery({
    queryKey: ['entidades-gestor-logistico-options'],
    queryFn: () => entidadesService.list({ tipo: 'GESTOR_LOGISTICO', activo: true, limit: 200 }),
    staleTime: 60_000,
    enabled: open,
  })
  const gestores = gestoresData?.data ?? []

  // Cuántos contenedores faltan por generar tras un éxito parcial (la reserva
  // automática falló a mitad) — el reintento "sin reserva" cubre solo estos.
  // `faltantesOffset` (IMP-QA-R1-034): cuántos YA se crearon acumulado — para
  // tomar del arreglo "individual" los datos de los contenedores correctos,
  // no repetir los de los primeros ya generados.
  const [faltantes, setFaltantes] = useState(0)
  const [faltantesOffset, setFaltantesOffset] = useState(0)

  function cerrarYRefrescar(navegarA?: number) {
    queryClient.invalidateQueries({ queryKey: embarquesKeys.list({ notaVentaId }) })
    queryClient.invalidateQueries({ queryKey: notasVentaKeys.all })
    setConfirmarSinReservaOpen(false)
    onOpenChange(false)
    if (navegarA != null) router.push(`/dashboard/ventas/embarques/${navegarA}`)
  }

  // Arma el arreglo `contenedores` (uno por contenedor, en orden) que espera
  // el backend — si es "mismo para todos", replica el mismo objeto. `offset`
  // (IMP-QA-R1-034): en el reintento "sin reserva" tras un éxito parcial, los
  // primeros `offset` contenedores YA se crearon con sus propios datos — hay
  // que tomar los datos de los que siguen, no repetir los de los ya creados.
  function buildContenedores(cant: number, offset: number): DatosContenedorInput[] {
    if (mismoParaTodos) {
      const datos = aInput(contenedorComun)
      return Array.from({ length: cant }, () => datos)
    }
    return contenedoresIndividuales.slice(offset, offset + cant).map(aInput)
  }

  const mutation = useMutation({
    mutationFn: (vars: { cantidad: number; forzar: boolean; offset: number }) =>
      embarquesService.createMultiples({
        notaVentaId,
        gestorLogisticoId: gestorLogisticoId!,
        cantidad: vars.cantidad,
        forzarSinReserva: vars.forzar,
        contenedores: buildContenedores(vars.cantidad, vars.offset),
      }),
    onSuccess: (res, vars) => {
      const embarques = res.data.embarques
      if (res.data.aglFallo) {
        // Éxito parcial: se crearon `creados` (desde `vars.offset`), la reserva
        // del siguiente falló. Se ofrece generar los restantes sin reserva
        // (reintento acotado) — el offset acumulado queda en `faltantesOffset`.
        setFaltantes(cantidad - vars.offset - res.data.creados)
        setFaltantesOffset(vars.offset + res.data.creados)
        if (res.data.creados > 0) {
          toast.warning(`Se generaron ${res.data.creados} de ${cantidad} — la reserva automática falló en el siguiente`)
          queryClient.invalidateQueries({ queryKey: embarquesKeys.list({ notaVentaId }) })
          queryClient.invalidateQueries({ queryKey: notasVentaKeys.all })
        }
        setConfirmarSinReservaOpen(true)
        return
      }
      const folios = embarques.map((e) => e.numeroInstructivo).join(', ')
      toast.success(
        embarques.length === 1
          ? `Embarque generado — Instructivo ${folios}`
          : `${embarques.length} Embarque(s) generado(s) — Instructivos ${folios}`,
      )
      // Con un solo Embarque se abre su detalle; con varios se vuelve al listado.
      cerrarYRefrescar(embarques.length === 1 ? embarques[0].id : undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al generar el Embarque'),
  })

  function actualizarIndividual(i: number, cambios: Partial<ContenedorForm>) {
    setContenedoresIndividuales((prev) => prev.map((c, j) => (j === i ? { ...c, ...cambios } : c)))
  }

  function camposContenedor(valor: ContenedorForm, onChange: (cambios: Partial<ContenedorForm>) => void) {
    return (
      <div className='grid grid-cols-3 gap-2'>
        <div className='space-y-1'>
          <Label className='text-[10px] uppercase'>Temperatura (°C)</Label>
          <Input type='number' step='1' value={valor.temperatura} onChange={(e) => onChange({ temperatura: e.target.value })} className='h-8' />
        </div>
        <div className='space-y-1'>
          <Label className='text-[10px] uppercase'>CBM</Label>
          <Input type='number' step='1' min={0} value={valor.cbm} onChange={(e) => onChange({ cbm: e.target.value })} className='h-8' />
        </div>
        <div className='space-y-1'>
          <Label className='text-[10px] uppercase'>Tipo de BL</Label>
          <Select value={valor.tipoBlId} onValueChange={(v) => onChange({ tipoBlId: v })}>
            <SelectTrigger className='h-8'><SelectValue placeholder='—' /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNO}>—</SelectItem>
              {(tiposBl?.data ?? []).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setGestorLogisticoId(null)
            setCantidad(1)
            setMismoParaTodos(true)
            setContenedorComun(contenedorVacio(NINGUNO))
            setContenedoresIndividuales([])
            setFaltantes(0)
            setFaltantesOffset(0)
          }
          onOpenChange(v)
        }}
      >
        <DialogContent className='max-h-[90vh] w-[95vw] overflow-auto sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Solicitar Reserva</DialogTitle>
            <DialogDescription>
              El número de instructivo se asigna automáticamente como un correlativo secuencial por Tipo de Embarque
              (con su prefijo configurado). Si el Gestor Logístico elegido tiene una integración activa, se intentará
              reservar espacio automáticamente — si no, el Embarque quedará listo para ingresar los datos de la reserva
              a mano.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-1.5'>
            <Label>Gestor Logístico <span className='text-destructive'>*</span></Label>
            <Combobox
              value={gestorLogisticoId ? String(gestorLogisticoId) : ''}
              onChange={(v) => setGestorLogisticoId(v ? Number(v) : null)}
              placeholder='Selecciona un gestor logístico...'
              searchPlaceholder='Buscar entidad...'
              options={gestores.map((e) => ({ value: String(e.id), label: e.descripcion }))}
            />
          </div>

          <div className='space-y-1.5'>
            <Label>Contenedores (reservas a generar) <span className='text-destructive'>*</span></Label>
            <Input
              type='number'
              min={1}
              max={100}
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />
            {estimacion?.data && (
              <p className='text-muted-foreground text-xs'>
                Sugerido: {estimacion.data.contenedoresSugeridos} ({estimacion.data.totalPallets} pallets ÷ {estimacion.data.palletsPorContenedor} por contenedor).
                Se genera un Embarque con su reserva por cada contenedor; su N° de instructivo es un correlativo secuencial por Tipo de Embarque.
              </p>
            )}
          </div>

          <div className='space-y-2 rounded-md border p-3'>
            <label className='flex items-center gap-2 text-sm'>
              <Checkbox checked={mismoParaTodos} onCheckedChange={(c) => setMismoParaTodos(!!c)} disabled={cantidad <= 1} />
              Usar el mismo valor de Temperatura/CBM/Tipo de BL para todos los contenedores
            </label>

            {mismoParaTodos || cantidad <= 1 ? (
              camposContenedor(contenedorComun, (cambios) => setContenedorComun((c) => ({ ...c, ...cambios })))
            ) : (
              <div className='max-h-64 space-y-3 overflow-y-auto'>
                {contenedoresIndividuales.map((c, i) => (
                  <div key={i} className='space-y-1'>
                    <p className='text-muted-foreground text-[10.5px] font-medium tracking-wide uppercase'>Contenedor {i + 1}</p>
                    {camposContenedor(c, (cambios) => actualizarIndividual(i, cambios))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => mutation.mutate({ cantidad, forzar: false, offset: 0 })} isLoading={mutation.isPending} disabled={!gestorLogisticoId}>
              <Icons.check className='mr-1 h-4 w-4' />
              Solicitar Reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertModal
        isOpen={confirmarSinReservaOpen}
        onClose={() => cerrarYRefrescar()}
        onConfirm={() => mutation.mutate({ cantidad: faltantes, forzar: true, offset: faltantesOffset })}
        loading={mutation.isPending}
        title='No se pudo conectar con AGL360'
        description={`No se pudo enviar la Solicitud de Reserva${faltantes > 0 ? ` de ${faltantes} contenedor(es) restante(s)` : ''}. ¿Generar ese/esos Embarque(s) de todas formas, sin reserva? Podrás reintentar la solicitud después desde cada Embarque.`}
      />
    </>
  )
}
