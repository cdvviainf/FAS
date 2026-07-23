'use client'

import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { usuariosService } from '../service'
import { usuariosKeys } from '../queries'

const ITEM = 'config.usuarios'

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

interface AvatarUploadFieldProps {
  usuarioId: string
  nombre: string
  imagenUrl: string | null
}

export function AvatarUploadField({ usuarioId, nombre, imagenUrl }: AvatarUploadFieldProps) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: usuariosKeys.detail(usuarioId) })
    queryClient.invalidateQueries({ queryKey: usuariosKeys.all })
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => usuariosService.subirAvatar(usuarioId, file),
    onSuccess: () => {
      toast.success('Avatar actualizado')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al subir el avatar'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => usuariosService.eliminarAvatar(usuarioId),
    onSuccess: () => {
      toast.success('Avatar eliminado')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el avatar'),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    uploadMutation.mutate(file)
  }

  return (
    <div className='flex items-center gap-4'>
      <Avatar className='size-16'>
        <AvatarImage src={usuariosService.avatarSrc(imagenUrl) ?? undefined} alt={nombre} />
        <AvatarFallback>{iniciales(nombre) || '?'}</AvatarFallback>
      </Avatar>

      {puedeEscribir && (
        <div className='flex gap-2'>
          <input
            ref={inputRef}
            type='file'
            accept='image/jpeg,image/png,image/webp'
            className='hidden'
            onChange={handleFileChange}
          />
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => inputRef.current?.click()}
            isLoading={uploadMutation.isPending}
          >
            <Icons.upload className='mr-1.5 h-3.5 w-3.5' />
            {imagenUrl ? 'Cambiar' : 'Subir imagen'}
          </Button>
          {imagenUrl && (
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
    </div>
  )
}
