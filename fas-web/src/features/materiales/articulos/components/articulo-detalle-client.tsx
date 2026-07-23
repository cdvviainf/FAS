'use client'

import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { articuloDetailOptions, articulosKeys } from '../queries'
import { articulosService } from '../service'
import { TIPO_ARTICULO_LABELS } from '../types'
import { recetasService } from '../../recetas/service'

const ITEM = 'operaciones.materiales'

function formatoBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export function ArticuloDetalleClient({ articuloId }: { articuloId: number }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const puedeEscribir = usePuedeEscribir(ITEM)

  const { data, isPending } = useQuery(articuloDetailOptions(articuloId))
  const { data: documentos } = useQuery({
    queryKey: articulosKeys.documentos(articuloId),
    queryFn: () => articulosService.listDocumentos(articuloId),
  })
  const { data: recetas } = useQuery({
    queryKey: ['recetas-de-embalaje', articuloId],
    queryFn: () => recetasService.listPorEmbalaje(articuloId),
    enabled: !!data?.data && data.data.tipo === 'EMBALAJE',
  })

  const subirMutation = useMutation({
    mutationFn: (archivo: File) => articulosService.subirDocumento(articuloId, archivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: articulosKeys.documentos(articuloId) })
      toast.success('Documento subido')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al subir el documento'),
  })
  const eliminarMutation = useMutation({
    mutationFn: (docId: number) => articulosService.eliminarDocumento(articuloId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: articulosKeys.documentos(articuloId) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el documento'),
  })

  if (isPending || !data?.data) return <p className='text-sm text-muted-foreground'>Cargando...</p>
  const articulo = data.data

  return (
    <div className='max-w-3xl space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            {articulo.codigo}
            <Badge variant='outline'>{TIPO_ARTICULO_LABELS[articulo.tipo]}</Badge>
            <Badge variant={articulo.activo ? 'default' : 'secondary'}>{articulo.activo ? 'Activo' : 'Inactivo'}</Badge>
          </CardTitle>
          <CardDescription>{articulo.descripcion}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-1 text-sm'>
          <p><span className='text-muted-foreground'>Unidad:</span> {articulo.unidad.descripcion}</p>
          <p><span className='text-muted-foreground'>Costeo:</span> {articulo.tipoCosteo === 'ESTANDAR' ? `Estándar ($${articulo.valorEstandar})` : 'Promedio Ponderado'}</p>
          {articulo.stockCritico && <p><span className='text-muted-foreground'>Stock crítico:</span> {articulo.stockCritico}</p>}
        </CardContent>
      </Card>

      {articulo.controlaStock && (
        <Card>
          <CardHeader><CardTitle className='text-base'>Saldos por bodega</CardTitle></CardHeader>
          <CardContent>
            {(articulo.saldos ?? []).length === 0 ? (
              <p className='text-sm text-muted-foreground'>Sin movimientos registrados.</p>
            ) : (
              <div className='space-y-1'>
                {articulo.saldos!.map((s) => (
                  <div key={s.bodegaId} className='flex justify-between text-sm'>
                    <span>{s.bodega.descripcion}</span>
                    <span>{s.cantidad} · PMP ${s.costoPromedio}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {articulo.tipo === 'EMBALAJE' && (
        <Card>
          <CardHeader><CardTitle className='text-base'>Recetas</CardTitle></CardHeader>
          <CardContent>
            {(recetas?.data ?? []).length === 0 ? (
              <p className='text-sm text-muted-foreground'>Este embalaje no tiene recetas definidas.</p>
            ) : (
              <div className='space-y-2'>
                {recetas!.data.map((r) => (
                  <div key={r.id} className='rounded-md border p-2 text-sm'>
                    <p className='font-medium'>{r.codigo} — {r.descripcion} ({r.cantidadAProducir} a producir)</p>
                    <ul className='ml-4 list-disc text-muted-foreground'>
                      {r.detalle.map((d) => (
                        <li key={d.id}>{d.componente.codigo} — {d.cantidadAConsumir}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className='text-base'>Documentos adjuntos</CardTitle></CardHeader>
        <CardContent className='space-y-2'>
          <input
            ref={inputRef}
            type='file'
            className='hidden'
            onChange={(e) => { if (e.target.files?.[0]) subirMutation.mutate(e.target.files[0]); e.target.value = '' }}
          />
          {puedeEscribir && (
            <Button type='button' variant='outline' size='sm' onClick={() => inputRef.current?.click()}>
              <Icons.upload className='mr-1 h-4 w-4' /> Agregar documento
            </Button>
          )}
          {(documentos?.data ?? []).map((d) => (
            <div key={d.id} className='flex items-center gap-2 text-sm'>
              <Icons.paperclip className='h-4 w-4 shrink-0 text-muted-foreground' />
              <a
                href={articulosService.urlDescargaDocumento(articuloId, d.id)}
                target='_blank'
                rel='noopener noreferrer'
                className='flex-1 truncate text-primary hover:underline'
              >
                {d.nombre}
              </a>
              <span className='text-xs text-muted-foreground'>{formatoBytes(d.tamano)}</span>
              {puedeEscribir && (
                <Button variant='ghost' size='icon' className='h-7 w-7' onClick={() => eliminarMutation.mutate(d.id)}>
                  <Icons.close className='h-4 w-4' />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
