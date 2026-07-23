'use client'

import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { contratosService } from '../service'
import type { Contrato } from '../types'
import { ContratoFormSheet } from './contrato-form-sheet'

// PROD-01: Contratos tiene su propio ítem de menú (PROD_CONTRATO), independiente
// de la Ficha (PROD_FICHA) — no se debe reutilizar el permiso de la ficha aquí.
const ITEM = 'productores.contrato'
const fmt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' })

export function ContratosTab({ entidadId, contratos, tieneRepresentanteLegal }: {
  entidadId: number
  contratos: Contrato[]
  tieneRepresentanteLegal: boolean
}) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [editItem, setEditItem] = useState<Contrato | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [subiendoId, setSubiendoId] = useState<number | null>(null)
  const [deleteItem, setDeleteItem] = useState<Contrato | undefined>()
  const inputRef = useRef<HTMLInputElement>(null)

  const invalidarFicha = () => queryClient.invalidateQueries({ queryKey: ['productores', 'ficha', entidadId] })

  const subirPdfMutation = useMutation({
    mutationFn: ({ contratoId, archivo }: { contratoId: number; archivo: File }) =>
      contratosService.subirPdf(entidadId, contratoId, archivo),
    onSuccess: () => {
      invalidarFicha()
      toast.success('PDF subido')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al subir el PDF'),
    onSettled: () => setSubiendoId(null),
  })

  // PROD-02: el contrato tiene DELETE en la API pero no había forma de eliminarlo desde la UI
  const deleteMutation = useMutation({
    mutationFn: (contratoId: number) => contratosService.remove(entidadId, contratoId),
    onSuccess: () => {
      invalidarFicha()
      toast.success('Contrato eliminado')
      setDeleteItem(undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el contrato'),
  })

  function iniciarSubida(contratoId: number) {
    setSubiendoId(contratoId)
    inputRef.current?.click()
  }

  return (
    <div className='space-y-3'>
      <input
        ref={inputRef}
        type='file'
        accept='application/pdf'
        className='hidden'
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          if (archivo && subiendoId) subirPdfMutation.mutate({ contratoId: subiendoId, archivo })
          e.target.value = ''
        }}
      />

      {puedeEscribir && (
        <>
          {!tieneRepresentanteLegal && (
            <p className='text-sm text-destructive'>
              Este productor no tiene representante legal registrado. Agrega uno en Contactos antes de crear un contrato (R3).
            </p>
          )}
          <Button onClick={() => { setEditItem(undefined); setFormOpen(true) }} disabled={!tieneRepresentanteLegal}>
            <Icons.add className='mr-2 h-4 w-4' /> Nuevo Contrato
          </Button>
        </>
      )}

      {contratos.length === 0 ? (
        <p className='text-sm text-muted-foreground'>Este productor no tiene contratos registrados.</p>
      ) : (
        <div className='space-y-3'>
          {contratos.map((c) => (
            <div key={c.id} className='rounded-md border p-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='font-medium'>
                    {c.temporada ? c.temporada.codigo : 'Sin temporada'}
                    {c.fechaInicio && ` — ${fmt.format(new Date(c.fechaInicio))}`}
                    {c.fechaTermino && ` a ${fmt.format(new Date(c.fechaTermino))}`}
                  </p>
                  {c.volumenComprometido && (
                    <p className='text-xs text-muted-foreground'>
                      Volumen comprometido: {c.volumenComprometido} {c.unidadVolumen}
                    </p>
                  )}
                </div>
                {puedeEscribir && (
                  <div className='flex gap-1'>
                    <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => { setEditItem(c); setFormOpen(true) }}>
                      <Icons.edit className='h-4 w-4' />
                    </Button>
                    <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => iniciarSubida(c.id)} disabled={subirPdfMutation.isPending}>
                      <Icons.upload className='h-4 w-4' />
                    </Button>
                    <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => setDeleteItem(c)}>
                      <Icons.trash className='h-4 w-4' />
                    </Button>
                  </div>
                )}
              </div>
              {c.pdfNombre ? (
                <a
                  href={contratosService.urlDescargaPdf(entidadId, c.id)}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline'
                >
                  <Icons.paperclip className='h-4 w-4' /> {c.pdfNombre}
                </a>
              ) : (
                <Badge variant='outline' className='mt-1'>Sin PDF adjunto</Badge>
              )}
              {(c.valoresFacturacion || c.condicionesPago || c.condicionesFacturacion) && (
                <div className='mt-2 space-y-1 text-xs text-muted-foreground'>
                  {c.valoresFacturacion && <p><strong>Valores facturación:</strong> {c.valoresFacturacion}</p>}
                  {c.condicionesPago && <p><strong>Condiciones pago:</strong> {c.condicionesPago}</p>}
                  {c.condicionesFacturacion && <p><strong>Condiciones facturación:</strong> {c.condicionesFacturacion}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ContratoFormSheet
        entidadId={entidadId}
        item={editItem}
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditItem(undefined) }}
      />
      <AlertModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(undefined)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        loading={deleteMutation.isPending}
        title='Eliminar contrato'
        description='¿Eliminar este contrato? Esta acción no se puede deshacer.'
      />
    </div>
  )
}
