'use client'

import { useState, useRef, useEffect } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MultiCombobox } from '@/components/shared/multi-combobox'
import { Icons } from '@/components/icons'
import { usuariosService } from '@/features/usuarios/service'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { solicitudesService } from '../service'
import { solicitudesKeys } from '../queries'
import { RESULTADO_CIERRE_LABELS } from '../types'
import type { SolicitudInspeccion, ResultadoCierre, AsignadoInput, SolicitudDefectoInput, TipoMedidaDefecto } from '../types'

const gruposDefectoService = createMantenedorService('grupos-defecto')
const defectosService = createMantenedorService('defectos')

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic'

interface DefectoOption {
  id: number
  descripcion: string
  grupoDefecto?: { id: number } | null
  tipoMedida: TipoMedidaDefecto
  // Validez por especie (N:M); vacío = defecto genérico (toda especie).
  especies?: { especieId: number }[]
}

function formatoBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

// ISO → valor para <input datetime-local> en hora local.
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

interface SolicitudCerrarDialogProps {
  solicitud: SolicitudInspeccion
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SolicitudCerrarDialog({ solicitud, open, onOpenChange }: SolicitudCerrarDialogProps) {
  const queryClient = useQueryClient()
  const [comentarios, setComentarios] = useState('')
  const [resultado, setResultado] = useState<ResultadoCierre | ''>('')
  const [fechaHora, setFechaHora] = useState('')
  const [acudeIds, setAcudeIds] = useState<string[]>([])
  const [defectos, setDefectos] = useState<SolicitudDefectoInput[]>([])
  // Editor de línea de defecto en curso.
  const [grupoSel, setGrupoSel] = useState('')
  const [defectoSel, setDefectoSel] = useState('')
  const [valorSel, setValorSel] = useState('')
  const [pendientes, setPendientes] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Prefill al abrir con lo que ya tenga la solicitud.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación al abrir
    setFechaHora(solicitud.fechaHora ? toLocalInput(solicitud.fechaHora) : '')
    setAcudeIds(solicitud.asignados.filter((a) => a.funcion === 'ACUDIR').map((a) => a.usuarioId))
    setDefectos(solicitud.defectos.map((d) => ({ grupoDefectoId: d.grupoDefecto.id, defectoId: d.defecto.id, valor: Number(d.valor) })))
    setGrupoSel('')
    setDefectoSel('')
    setValorSel('')
  }, [open, solicitud])

  const { data: usuarios } = useQuery({ queryKey: ['usuarios-options'], queryFn: () => usuariosService.list({ limit: 500 }), staleTime: 5 * 60_000, enabled: open })
  const { data: gruposData } = useQuery({ queryKey: ['grupos-defecto-options'], queryFn: () => gruposDefectoService.list({ soloActivos: true, limit: 500 }), staleTime: 5 * 60_000, enabled: open })
  const { data: defectosData } = useQuery({ queryKey: ['defectos-options'], queryFn: () => defectosService.list({ soloActivos: true, limit: 500 }), staleTime: 5 * 60_000, enabled: open })

  const grupos = gruposData?.data ?? []
  const defectosCatalogo = (defectosData?.data ?? []) as unknown as DefectoOption[]
  // Filtra por grupo y por especie de la solicitud: si la solicitud tiene
  // especie, solo defectos genéricos (sin especies) o válidos para esa especie.
  const defectosDelGrupo = grupoSel
    ? defectosCatalogo.filter((d) => {
        if (d.grupoDefecto?.id !== Number(grupoSel)) return false
        if (solicitud.especieId == null) return true
        const especies = d.especies ?? []
        return especies.length === 0 || especies.some((e) => e.especieId === solicitud.especieId)
      })
    : []
  const defectoElegido = defectoSel ? defectosCatalogo.find((d) => d.id === Number(defectoSel)) : undefined

  const cerrarMutation = useMutation({
    mutationFn: async () => {
      for (const archivo of pendientes) {
        await solicitudesService.subirAdjunto(solicitud.id, archivo, 'CIERRE')
      }
      // Asignados: los que acuden (ACUDIR) + se preservan los NOTIFICAR actuales
      // EXCLUYENDO a quienes ahora acuden (un usuario no puede tener dos filas).
      const acudeSet = new Set(acudeIds)
      const notificar = solicitud.asignados
        .filter((a) => a.funcion === 'NOTIFICAR' && !acudeSet.has(a.usuarioId))
        .map((a) => ({ usuarioId: a.usuarioId, funcion: 'NOTIFICAR' as const }))
      const asignados: AsignadoInput[] = [...acudeIds.map((usuarioId) => ({ usuarioId, funcion: 'ACUDIR' as const })), ...notificar]
      return solicitudesService.cerrar(solicitud.id, {
        comentarios: comentarios.trim(),
        resultado: resultado as ResultadoCierre,
        fechaHora: fechaHora ? new Date(fechaHora).toISOString() : null,
        asignados,
        defectos,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.all })
      toast.success('Inspección cerrada. Se notificó a los involucrados.')
      onOpenChange(false)
      setComentarios('')
      setResultado('')
      setPendientes([])
    },
    onError: (e: Error) => toast.error(e.message || 'Error al cerrar la inspección'),
  })

  function agregarArchivos(files: FileList | null) {
    if (!files) return
    const validos: File[] = []
    for (const f of Array.from(files)) {
      if (f.size > MAX_BYTES) {
        toast.error(`"${f.name}" supera los 10 MB`)
        continue
      }
      validos.push(f)
    }
    setPendientes((prev) => [...prev, ...validos])
    if (inputRef.current) inputRef.current.value = ''
  }

  function agregarDefecto() {
    if (!grupoSel || !defectoSel || !defectoElegido) {
      toast.error('Selecciona grupo y defecto')
      return
    }
    const valor = Number(valorSel.replace(',', '.'))
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error('Ingresa un valor válido')
      return
    }
    if (defectoElegido.tipoMedida === 'PORCENTAJE') {
      if (valor > 100) { toast.error('El porcentaje no puede superar 100'); return }
    } else if (!Number.isInteger(valor)) {
      toast.error('El valor por unidades debe ser un número entero')
      return
    }
    if (defectos.some((d) => d.grupoDefectoId === Number(grupoSel) && d.defectoId === Number(defectoSel))) {
      toast.error('Ese defecto ya está agregado')
      return
    }
    setDefectos((prev) => [...prev, { grupoDefectoId: Number(grupoSel), defectoId: Number(defectoSel), valor }])
    setDefectoSel('')
    setValorSel('')
  }

  function etiquetaDefecto(d: SolicitudDefectoInput): string {
    const def = defectosCatalogo.find((x) => x.id === d.defectoId)
    const grupo = grupos.find((g) => g.id === d.grupoDefectoId)
    const sufijo = def?.tipoMedida === 'PORCENTAJE' ? '%' : ' u.'
    const valorFmt = String(d.valor).replace('.', ',')
    return `${grupo?.descripcion ?? d.grupoDefectoId} · ${def?.descripcion ?? d.defectoId}: ${valorFmt}${sufijo}`
  }

  function handleCerrar() {
    if (!comentarios.trim()) { toast.error('Los comentarios de cierre son requeridos'); return }
    if (!resultado) { toast.error('Debes indicar el resultado de la inspección'); return }
    if (!fechaHora) { toast.error('Ingresa la fecha y hora de la visita'); return }
    if (acudeIds.length === 0) { toast.error('Indica quién asiste a la visita'); return }
    cerrarMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] max-w-lg overflow-auto'>
        <DialogHeader>
          <DialogTitle>Cerrar inspección {solicitud.codigo}</DialogTitle>
          <DialogDescription>
            Registra la fecha de la visita, quién asistió, los defectos detectados y el resultado. Al cerrar
            se notificará a los asignados y al solicitante.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label>Resultado <span className='text-destructive'>*</span></Label>
              <Select value={resultado} onValueChange={(v) => setResultado(v as ResultadoCierre)}>
                <SelectTrigger><SelectValue placeholder='Selecciona...' /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(RESULTADO_CIERRE_LABELS) as ResultadoCierre[]).map((r) => (
                    <SelectItem key={r} value={r}>{RESULTADO_CIERRE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Fecha y hora de visita <span className='text-destructive'>*</span></Label>
              <Input type='datetime-local' value={fechaHora} onChange={(e) => setFechaHora(e.target.value)} />
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label>Quién asiste <span className='text-destructive'>*</span></Label>
            <MultiCombobox
              options={(usuarios?.data ?? []).map((u) => ({ value: u.id, label: u.nombre }))}
              selected={acudeIds}
              onChange={setAcudeIds}
              placeholder='Selecciona quién asiste a la visita...'
            />
          </div>

          <div className='space-y-1.5'>
            <Label>Comentarios <span className='text-destructive'>*</span></Label>
            <Textarea rows={4} value={comentarios} onChange={(e) => setComentarios(e.target.value)} placeholder='Hallazgos, observaciones...' />
          </div>

          {/* Defectos detectados en la visita */}
          <div className='space-y-2'>
            <Label>Defectos</Label>
            {defectos.length > 0 && (
              <div className='flex flex-wrap gap-1.5'>
                {defectos.map((d, i) => (
                  <Badge key={i} variant='secondary' className='gap-1 pr-1'>
                    {etiquetaDefecto(d)}
                    <button type='button' onClick={() => setDefectos((prev) => prev.filter((_, j) => j !== i))} className='ml-0.5 rounded-sm hover:bg-muted-foreground/20'>
                      <Icons.close className='h-3 w-3' />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className='grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end'>
              <div className='space-y-1'>
                <Label className='text-xs'>Grupo</Label>
                <Select value={grupoSel} onValueChange={(v) => { setGrupoSel(v); setDefectoSel(''); setValorSel('') }}>
                  <SelectTrigger><SelectValue placeholder='Grupo...' /></SelectTrigger>
                  <SelectContent>
                    {grupos.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.descripcion}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1'>
                <Label className='text-xs'>Defecto</Label>
                <Select value={defectoSel} onValueChange={setDefectoSel} disabled={!grupoSel}>
                  <SelectTrigger><SelectValue placeholder='Defecto...' /></SelectTrigger>
                  <SelectContent>
                    {defectosDelGrupo.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.descripcion}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1'>
                <Label className='text-xs'>{defectoElegido?.tipoMedida === 'PORCENTAJE' ? 'Valor (%)' : 'Valor (u.)'}</Label>
                <Input
                  className='w-24'
                  value={valorSel}
                  onChange={(e) => setValorSel(e.target.value)}
                  placeholder={defectoElegido?.tipoMedida === 'PORCENTAJE' ? '12,5' : '3'}
                  disabled={!defectoSel}
                />
              </div>
              <Button type='button' variant='secondary' onClick={agregarDefecto} disabled={!defectoSel || !valorSel}>
                <Icons.add className='mr-1 h-4 w-4' /> Agregar
              </Button>
            </div>
            <p className='text-muted-foreground text-xs'>Según el defecto: por unidades (entero) o porcentaje (ej. 12,5).</p>
          </div>

          <div className='space-y-2'>
            <Label>Archivos adjuntos</Label>
            <input ref={inputRef} type='file' multiple accept={ACCEPT} className='hidden' onChange={(e) => agregarArchivos(e.target.files)} />
            <Button type='button' variant='outline' size='sm' onClick={() => inputRef.current?.click()}>
              <Icons.upload className='mr-1 h-4 w-4' /> Agregar archivos
            </Button>
            <p className='text-xs text-muted-foreground'>PDF, Word, Excel o imágenes. Máx. 10 MB por archivo.</p>
            {pendientes.length > 0 && (
              <div className='space-y-1 rounded-md border p-2'>
                {pendientes.map((f, idx) => (
                  <div key={idx} className='flex items-center gap-2 text-sm'>
                    <Icons.paperclip className='h-4 w-4 shrink-0 text-muted-foreground' />
                    <span className='flex-1 truncate'>{f.name}</span>
                    <span className='text-xs text-muted-foreground'>{formatoBytes(f.size)}</span>
                    <Button type='button' variant='ghost' size='icon' className='h-7 w-7' onClick={() => setPendientes((prev) => prev.filter((_, i) => i !== idx))}>
                      <Icons.close className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={cerrarMutation.isPending}>Cancelar</Button>
          <Button onClick={handleCerrar} isLoading={cerrarMutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> Cerrar inspección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
