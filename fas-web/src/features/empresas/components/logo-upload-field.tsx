'use client'

import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { empresasService } from '../service'
import { empresasKeys } from '../queries'
import type { EmpresaLogoInfo } from '../types'

const ITEM = 'CONFIG_EMPRESAS'
const MIMES_ACEPTADOS = 'image/png,image/jpeg,image/webp,image/svg+xml'

interface LogoUploadFieldProps {
  empresaId: number
  logo: EmpresaLogoInfo | null
}

// Mismo patrón que AvatarUploadField (usuarios) — metadata + binario servido
// por endpoint propio, ver empresas.controller.ts#descargarLogo. Este logo
// es el que sale en el Encabezado de los documentos PDF (Motor de
// Documentos, orden-compra.resolver.ts#logoDataUri).
export function LogoUploadField({ empresaId, logo }: LogoUploadFieldProps) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: empresasKeys.detail(empresaId) })
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => empresasService.subirLogo(empresaId, file),
    onSuccess: () => {
      toast.success('Logo actualizado')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al subir el logo'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => empresasService.eliminarLogo(empresaId),
    onSuccess: () => {
      toast.success('Logo eliminado')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el logo'),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    uploadMutation.mutate(file)
  }

  return (
    <div className='space-y-4'>
      <div className='flex h-32 w-full max-w-sm items-center justify-center rounded-md border bg-muted/30 p-4'>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- data servida por fas-api, no por next/image
          <img
            src={empresasService.logoSrc(empresaId, logo.subidoEn)}
            alt='Logo de la empresa'
            className='max-h-full max-w-full object-contain'
          />
        ) : (
          <div className='flex flex-col items-center gap-1.5 text-muted-foreground'>
            <Icons.media className='h-8 w-8 opacity-40' />
            <span className='text-xs'>Sin logo</span>
          </div>
        )}
      </div>

      {logo && (
        <p className='text-xs text-muted-foreground'>
          Subido el {new Date(logo.subidoEn).toLocaleString('es-CL')}
        </p>
      )}

      {puedeEscribir && (
        <div className='flex gap-2'>
          <input
            ref={inputRef}
            type='file'
            accept={MIMES_ACEPTADOS}
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
            {logo ? 'Cambiar' : 'Subir logo'}
          </Button>
          {logo && (
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
      <p className='text-xs text-muted-foreground'>
        PNG, JPEG, WebP o SVG · máx. 2MB. Aparece en el encabezado de los documentos PDF (Órdenes de Compra, etc.).
      </p>
    </div>
  )
}
