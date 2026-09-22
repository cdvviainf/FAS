'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Combobox } from '@/components/ui/combobox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { entidadesService } from '@/features/entidades/service'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { DocumentoPreviewDialog } from '@/features/documentos/components/documento-preview-dialog'
import { embarquesService } from '../service'
import { embarquesKeys } from '../queries'
import type { DatosInstructivoInput, EmbarqueDetalle, InstructivoHijo, InstructivoHijoUpdateInput } from '../types'

const ITEM = 'VENTAS_EMBARQUES'
const puertosService = createMantenedorService('puertos')

function soloFecha(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

// Valor para un input `datetime-local` (formato `YYYY-MM-DDTHH:mm`, sin
// zona) — FAS-IE-QA-002 (QA ronda 1): R11 exige fecha/hora para los hitos
// por planta, no solo fecha; la columna en BD ya es DateTime completo, esto
// deja de truncarla en la captura.
function soloFechaHora(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface DatosInstructivoForm {
  puertoZarpeId: string
  voyageNumber: string
  deposito: string
  awbBl: string
  cutoffDate: string
  tipoBultos: string
  agenteAduanaId: string
  embarcadorId: string
  navieraId: string
}

function formInicial(embarque: EmbarqueDetalle): DatosInstructivoForm {
  return {
    puertoZarpeId: embarque.puertoZarpeId ? String(embarque.puertoZarpeId) : '',
    voyageNumber: embarque.voyageNumber ?? '',
    deposito: embarque.deposito ?? '',
    awbBl: embarque.awbBl ?? '',
    cutoffDate: soloFecha(embarque.cutoffDate),
    tipoBultos: embarque.tipoBultos ?? '',
    agenteAduanaId: embarque.agenteAduanaId ? String(embarque.agenteAduanaId) : '',
    embarcadorId: embarque.embarcadorId ? String(embarque.embarcadorId) : '',
    navieraId: embarque.navieraId ? String(embarque.navieraId) : '',
  }
}

// Edición de un InstructivoHijo (hitos por Planta, ventas.md R11) — la
// pertenencia (planta/secuencia/código) es siempre derivada, nunca editable.
function InstructivoHijoEditDialog({
  instructivo,
  embarqueId,
  open,
  onOpenChange,
}: {
  instructivo: InstructivoHijo
  embarqueId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => ({
    fechaCargaPlanta: soloFechaHora(instructivo.fechaCargaPlanta),
    stackingDesde: soloFechaHora(instructivo.stackingDesde),
    stackingHasta: soloFechaHora(instructivo.stackingHasta),
    observaciones: instructivo.observaciones ?? '',
  }))

  const mutation = useMutation({
    mutationFn: (datos: InstructivoHijoUpdateInput) => embarquesService.actualizarInstructivoHijo(embarqueId, instructivo.id, datos),
    onSuccess: () => {
      toast.success('Instructivo actualizado')
      queryClient.invalidateQueries({ queryKey: embarquesKeys.detail(embarqueId) })
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo guardar el instructivo'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Instructivo {instructivo.codigo}</DialogTitle>
          <DialogDescription>Planta {instructivo.planta.descripcion} — hitos de retiro.</DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <div className='space-y-1.5'>
            <Label>Carga en planta</Label>
            <Input type='datetime-local' value={form.fechaCargaPlanta} onChange={(e) => setForm((f) => ({ ...f, fechaCargaPlanta: e.target.value }))} />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Stacking desde</Label>
              <Input type='datetime-local' value={form.stackingDesde} onChange={(e) => setForm((f) => ({ ...f, stackingDesde: e.target.value }))} />
            </div>
            <div className='space-y-1.5'>
              <Label>Stacking hasta</Label>
              <Input type='datetime-local' value={form.stackingHasta} onChange={(e) => setForm((f) => ({ ...f, stackingHasta: e.target.value }))} />
            </div>
          </div>
          <div className='space-y-1.5'>
            <Label>Observaciones</Label>
            <Textarea value={form.observaciones} onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            type='button'
            isLoading={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                fechaCargaPlanta: form.fechaCargaPlanta || null,
                stackingDesde: form.stackingDesde || null,
                stackingHasta: form.stackingHasta || null,
                observaciones: form.observaciones || null,
              })
            }
          >
            <Icons.check className='mr-1 h-4 w-4' /> Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GenerarInstructivosTab({ embarque }: { embarque: EmbarqueDetalle }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DatosInstructivoForm>(() => formInicial(embarque))
  const [editando, setEditando] = useState<InstructivoHijo | null>(null)
  const [pdfInstructivo, setPdfInstructivo] = useState<InstructivoHijo | null>(null)

  const invalidar = () => queryClient.invalidateQueries({ queryKey: embarquesKeys.detail(embarque.id) })

  const { data: puertosData } = useQuery({
    queryKey: ['puertos-options-instructivo'],
    queryFn: () => puertosService.list({ limit: 200 }),
    staleTime: 60_000,
  })
  const { data: agentesData } = useQuery({
    queryKey: ['entidades-agente-aduana-options'],
    queryFn: () => entidadesService.list({ tipo: 'AGENTE_ADUANA', activo: true, limit: 200 }),
    staleTime: 60_000,
  })
  const { data: embarcadoresData } = useQuery({
    queryKey: ['entidades-embarcador-options'],
    queryFn: () => entidadesService.list({ tipo: 'COMPANIA_EMBARQUE', activo: true, limit: 200 }),
    staleTime: 60_000,
  })
  const { data: navierasData } = useQuery({
    queryKey: ['entidades-naviera-options'],
    queryFn: () => entidadesService.list({ tipo: 'NAVIERA', activo: true, limit: 200 }),
    staleTime: 60_000,
  })

  const guardarDatosMutation = useMutation({
    mutationFn: (datos: DatosInstructivoInput) => embarquesService.guardarDatosInstructivo(embarque.id, datos),
    onSuccess: () => {
      toast.success('Datos del Instructivo guardados')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudieron guardar los datos del Instructivo'),
  })

  const generarMutation = useMutation({
    mutationFn: () => embarquesService.generarInstructivosHijos(embarque.id),
    onSuccess: (res) => {
      toast.success(`${res.data.length} Instructivo${res.data.length === 1 ? '' : 's'} generado${res.data.length === 1 ? '' : 's'}`)
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudieron generar los Instructivos'),
  })

  const guardarDatos = () => {
    guardarDatosMutation.mutate({
      puertoZarpeId: form.puertoZarpeId ? Number(form.puertoZarpeId) : null,
      voyageNumber: form.voyageNumber || null,
      deposito: form.deposito || null,
      awbBl: form.awbBl || null,
      cutoffDate: form.cutoffDate || null,
      tipoBultos: form.tipoBultos || null,
      agenteAduanaId: form.agenteAduanaId ? Number(form.agenteAduanaId) : null,
      embarcadorId: form.embarcadorId ? Number(form.embarcadorId) : null,
      navieraId: form.navieraId ? Number(form.navieraId) : null,
    })
  }

  const instructivos = embarque.instructivosHijos

  return (
    <div className='space-y-6'>
      <div className='space-y-3 rounded-md border p-6'>
        <h3 className='text-sm font-semibold'>Datos del Instructivo</h3>
        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1.5'>
            <Label>Puerto de zarpe</Label>
            <Combobox
              value={form.puertoZarpeId}
              onChange={(v) => setForm((f) => ({ ...f, puertoZarpeId: v }))}
              placeholder='Seleccionar puerto...'
              searchPlaceholder='Buscar puerto...'
              options={(puertosData?.data ?? []).map((p) => ({ value: String(p.id), label: p.descripcion }))}
              disabled={!puedeEscribir}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>Naviera</Label>
            <Combobox
              value={form.navieraId}
              onChange={(v) => setForm((f) => ({ ...f, navieraId: v }))}
              placeholder='Seleccionar naviera...'
              searchPlaceholder='Buscar naviera...'
              options={(navierasData?.data ?? []).map((e) => ({ value: String(e.id), label: e.descripcion }))}
              disabled={!puedeEscribir}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>Embarcador</Label>
            <Combobox
              value={form.embarcadorId}
              onChange={(v) => setForm((f) => ({ ...f, embarcadorId: v }))}
              placeholder='Seleccionar embarcador...'
              searchPlaceholder='Buscar embarcador...'
              options={(embarcadoresData?.data ?? []).map((e) => ({ value: String(e.id), label: e.descripcion }))}
              disabled={!puedeEscribir}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>Agente de aduana</Label>
            <Combobox
              value={form.agenteAduanaId}
              onChange={(v) => setForm((f) => ({ ...f, agenteAduanaId: v }))}
              placeholder='Seleccionar agente...'
              searchPlaceholder='Buscar agente...'
              options={(agentesData?.data ?? []).map((e) => ({ value: String(e.id), label: e.descripcion }))}
              disabled={!puedeEscribir}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>Voyage Number</Label>
            <Input value={form.voyageNumber} onChange={(e) => setForm((f) => ({ ...f, voyageNumber: e.target.value }))} disabled={!puedeEscribir} />
          </div>
          <div className='space-y-1.5'>
            <Label>Depósito</Label>
            <Input value={form.deposito} onChange={(e) => setForm((f) => ({ ...f, deposito: e.target.value }))} disabled={!puedeEscribir} />
          </div>
          <div className='space-y-1.5'>
            <Label>AWB / BL</Label>
            <Input value={form.awbBl} onChange={(e) => setForm((f) => ({ ...f, awbBl: e.target.value }))} disabled={!puedeEscribir} />
          </div>
          <div className='space-y-1.5'>
            <Label>Tipo de bultos</Label>
            <Input value={form.tipoBultos} onChange={(e) => setForm((f) => ({ ...f, tipoBultos: e.target.value }))} disabled={!puedeEscribir} />
          </div>
          <div className='space-y-1.5'>
            <Label>Cutoff</Label>
            <Input type='date' value={form.cutoffDate} onChange={(e) => setForm((f) => ({ ...f, cutoffDate: e.target.value }))} disabled={!puedeEscribir} />
          </div>
        </div>
        {puedeEscribir && (
          <Button type='button' onClick={guardarDatos} isLoading={guardarDatosMutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> Guardar
          </Button>
        )}
      </div>

      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-semibold'>Instructivos por planta</h3>
          {puedeEscribir && (
            <Button type='button' variant='outline' onClick={() => generarMutation.mutate()} isLoading={generarMutation.isPending}>
              <Icons.check className='mr-1 h-4 w-4' /> Generar Instructivos
            </Button>
          )}
        </div>

        {instructivos.length === 0 ? (
          <p className='text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm'>
            Sin Instructivos generados — usa &quot;Generar Instructivos&quot; una vez que haya pallets reservados en
            Seleccionar Pallets.
          </p>
        ) : (
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Planta</TableHead>
                  <TableHead>Carga en planta</TableHead>
                  <TableHead>Stacking</TableHead>
                  <TableHead className='w-32'></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instructivos.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className='font-medium'>{i.codigo}</TableCell>
                    <TableCell>{i.planta.descripcion}</TableCell>
                    <TableCell>{i.fechaCargaPlanta ? new Date(i.fechaCargaPlanta).toLocaleString('es-CL') : '—'}</TableCell>
                    <TableCell>
                      {i.stackingDesde || i.stackingHasta
                        ? `${i.stackingDesde ? new Date(i.stackingDesde).toLocaleString('es-CL') : '—'} a ${i.stackingHasta ? new Date(i.stackingHasta).toLocaleString('es-CL') : '—'}`
                        : '—'}
                    </TableCell>
                    <TableCell className='flex justify-end gap-1'>
                      {puedeEscribir && (
                        <Button type='button' variant='ghost' size='icon' onClick={() => setEditando(i)}>
                          <Icons.edit className='h-4 w-4' />
                        </Button>
                      )}
                      <Button type='button' variant='ghost' size='icon' onClick={() => setPdfInstructivo(i)}>
                        <Icons.download className='h-4 w-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {editando && (
        <InstructivoHijoEditDialog
          instructivo={editando}
          embarqueId={embarque.id}
          open={!!editando}
          onOpenChange={(open) => !open && setEditando(null)}
        />
      )}

      {pdfInstructivo && (
        <DocumentoPreviewDialog
          tipo='instructivo-embarque'
          id={pdfInstructivo.id}
          titulo={`Instructivo de Embarque ${pdfInstructivo.codigo}`}
          controlCopia={false}
          orientacion='portrait'
          open={!!pdfInstructivo}
          onOpenChange={(open) => !open && setPdfInstructivo(null)}
        />
      )}
    </div>
  )
}
