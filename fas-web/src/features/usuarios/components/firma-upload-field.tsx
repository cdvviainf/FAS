'use client'

import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { usuariosService } from '../service'
import { usuariosKeys } from '../queries'

const ITEM = 'CONFIG_USUARIOS'

// Fondo cuadriculado para que se note la transparencia del PNG.
export const FONDO_CUADRICULADO: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
}

interface FirmaUploadFieldProps {
  usuarioId: string
  tieneFirma: boolean
  // Cambia al re-subir para forzar recarga de la imagen (cache del navegador).
  version?: string | null
}

// Firma del responsable de venta (2026-11-05): PNG con fondo transparente, se
// estampa sobre la línea de firma del PDF de Cierre Comercial. El backend
// valida PNG + canal alfa, máx. 1 MB.
export function FirmaUploadField({ usuarioId, tieneFirma, version }: FirmaUploadFieldProps) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: usuariosKeys.detail(usuarioId) })
    queryClient.invalidateQueries({ queryKey: usuariosKeys.all })
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => usuariosService.subirFirma(usuarioId, file),
    onSuccess: () => {
      toast.success('Firma actualizada')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al subir la firma'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => usuariosService.eliminarFirma(usuarioId),
    onSuccess: () => {
      toast.success('Firma eliminada')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar la firma'),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    uploadMutation.mutate(file)
  }

  return (
    <div className='flex flex-wrap items-center gap-4'>
      <div className='flex h-20 w-56 items-center justify-center rounded border' style={FONDO_CUADRICULADO}>
        {tieneFirma ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${usuariosService.firmaSrc(usuarioId)}?v=${encodeURIComponent(version ?? '')}`}
            alt='Firma'
            className='max-h-full max-w-full object-contain'
          />
        ) : (
          <span className='text-muted-foreground text-xs'>Sin firma</span>
        )}
      </div>

      {puedeEscribir && (
        <div className='flex gap-2'>
          <input ref={inputRef} type='file' accept='image/png' className='hidden' onChange={handleFileChange} />
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => inputRef.current?.click()}
            isLoading={uploadMutation.isPending}
          >
            <Icons.upload className='mr-1.5 h-3.5 w-3.5' />
            {tieneFirma ? 'Cambiar' : 'Subir firma (PNG)'}
          </Button>
          {tieneFirma && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => deleteMutation.mutate()}
              isLoading={deleteMutation.isPending}
            >
              <Icons.trash className='mr-1.5 h-3.5 w-3.5' />
              Eliminar
            </Button>
          )}
        </div>
      )}
      <p className='text-muted-foreground w-full text-xs'>PNG con fondo transparente, máximo 1 MB. Se usa en el PDF del Cierre Comercial.</p>
    </div>
  )
}
