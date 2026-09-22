'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { DocumentoPreviewDialog } from '@/features/documentos/components/documento-preview-dialog'
import { embarquesService } from '../service'
import { embarquesKeys } from '../queries'
import type { EmbarqueDetalle, InstructivoHijo, InstructivoHijoUpdateInput } from '../types'

const ITEM = 'VENTAS_EMBARQUES'

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

// Solo la generación/sincronización por Planta y el listado resultante — los
// datos compartidos del Instructivo (puerto de zarpe, naviera, embarcador,
// etc.) viven en la pestaña Solicitud de Reserva (2026-09-22, decisión de
// negocio Christian: "todos los datos del instructivo en la misma pantalla").
export function GenerarInstructivosTab({ embarque }: { embarque: EmbarqueDetalle }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState<InstructivoHijo | null>(null)
  const [pdfInstructivo, setPdfInstructivo] = useState<InstructivoHijo | null>(null)

  const generarMutation = useMutation({
    mutationFn: () => embarquesService.generarInstructivosHijos(embarque.id),
    onSuccess: (res) => {
      toast.success(`${res.data.length} Instructivo${res.data.length === 1 ? '' : 's'} generado${res.data.length === 1 ? '' : 's'}`)
      queryClient.invalidateQueries({ queryKey: embarquesKeys.detail(embarque.id) })
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudieron generar los Instructivos'),
  })

  const instructivos = embarque.instructivosHijos

  return (
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
                <TableHead className='w-32'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructivos.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className='font-medium'>{i.codigo}</TableCell>
                  <TableCell>{i.planta.descripcion}</TableCell>
                  <TableCell>{i.fechaCargaPlanta ? new Date(i.fechaCargaPlanta).toLocaleString('es-CL') : '—'}</TableCell>
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
