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
const ITEM = 'PROD_CONTRATO'
const fmt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' })

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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
  const [deleteAdjunto, setDeleteAdjunto] = useState<{ contratoId: number; adjuntoId: number; nombre: string } | undefined>()
  const inputRef = useRef<HTMLInputElement>(null)

  const invalidarFicha = () => queryClient.invalidateQueries({ queryKey: ['productores', 'ficha', entidadId] })

  const agregarAdjuntoMutation = useMutation({
    mutationFn: ({ contratoId, archivo }: { contratoId: number; archivo: File }) =>
      contratosService.agregarAdjunto(entidadId, contratoId, archivo),
    onSuccess: () => {
      invalidarFicha()
      toast.success('Documento adjuntado')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al adjuntar el documento'),
    onSettled: () => setSubiendoId(null),
  })

  const eliminarAdjuntoMutation = useMutation({
    mutationFn: ({ contratoId, adjuntoId }: { contratoId: number; adjuntoId: number }) =>
      contratosService.eliminarAdjunto(entidadId, contratoId, adjuntoId),
    onSuccess: () => {
      invalidarFicha()
      toast.success('Documento eliminado')
      setDeleteAdjunto(undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el documento'),
  })

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
        className='hidden'
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          if (archivo && subiendoId) agregarAdjuntoMutation.mutate({ contratoId: subiendoId, archivo })
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
            <div key={c.id} className='space-y-3 rounded-md border p-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='font-medium'>
                    {c.especie.descripcion} — {c.temporada.codigo}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {fmt.format(new Date(c.fechaInicio))} a {fmt.format(new Date(c.fechaTermino))}
                  </p>
                </div>
                {puedeEscribir && (
                  <div className='flex gap-1'>
                    <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => { setEditItem(c); setFormOpen(true) }}>
                      <Icons.edit className='h-4 w-4' />
                    </Button>
                    <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => iniciarSubida(c.id)} disabled={agregarAdjuntoMutation.isPending}>
                      <Icons.upload className='h-4 w-4' />
                    </Button>
                    <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => setDeleteItem(c)}>
                      <Icons.trash className='h-4 w-4' />
                    </Button>
                  </div>
                )}
              </div>

              {c.lineas.length > 0 && (
                <div className='overflow-auto rounded border'>
                  <table className='w-full text-xs'>
                    <thead className='bg-muted/50'>
                      <tr>
                        <th className='p-1.5 text-left'>Embalaje</th>
                        <th className='p-1.5 text-left'>Variedad</th>
                        <th className='p-1.5 text-left'>Categoría</th>
                        <th className='p-1.5 text-left'>Calibre</th>
                        <th className='p-1.5 text-right'>Comprometido</th>
                        <th className='p-1.5 text-right'>Mín. garantizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.lineas.map((l) => (
                        <tr key={l.id} className='border-t'>
                          <td className='p-1.5'>{l.articulo.codigo}</td>
                          <td className='p-1.5'>{l.variedad.descripcion}</td>
                          <td className='p-1.5'>{l.categoria.descripcion}</td>
                          <td className='p-1.5'>{l.calibreDesde.descripcion}–{l.calibreHasta.descripcion}</td>
                          <td className='p-1.5 text-right'>{l.cantidadComprometida} {l.unidadMedida.codigo}</td>
                          <td className='p-1.5 text-right'>{l.minimoGarantizado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className='space-y-1'>
                <p className='text-xs font-medium text-muted-foreground'>Documentos adjuntos</p>
                {c.adjuntos.length === 0 ? (
                  <Badge variant='outline'>Sin documentos adjuntos</Badge>
                ) : (
                  <ul className='space-y-1'>
                    {c.adjuntos.map((a) => (
                      <li key={a.id} className='flex items-center justify-between gap-2 text-sm'>
                        <a
                          href={contratosService.urlDescargaAdjunto(entidadId, c.id, a.id)}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center gap-1 text-primary hover:underline'
                        >
                          <Icons.paperclip className='h-4 w-4' /> {a.nombre}
                        </a>
                        <span className='text-xs text-muted-foreground'>{formatBytes(a.tamano)}</span>
                        {puedeEscribir && (
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-6 w-6'
                            onClick={() => setDeleteAdjunto({ contratoId: c.id, adjuntoId: a.id, nombre: a.nombre })}
                          >
                            <Icons.trash className='h-3.5 w-3.5' />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
      <AlertModal
        isOpen={!!deleteAdjunto}
        onClose={() => setDeleteAdjunto(undefined)}
        onConfirm={() => deleteAdjunto && eliminarAdjuntoMutation.mutate({ contratoId: deleteAdjunto.contratoId, adjuntoId: deleteAdjunto.adjuntoId })}
        loading={eliminarAdjuntoMutation.isPending}
        title='Eliminar documento'
        description={`¿Eliminar el documento "${deleteAdjunto?.nombre}"?`}
      />
    </div>
  )
}
