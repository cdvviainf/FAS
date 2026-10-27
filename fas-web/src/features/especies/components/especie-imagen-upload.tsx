'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { especieImagenService } from '../image-service'

const ITEM = 'CONFIG_ESPECIES'
const MIMES_ACEPTADOS = 'image/png,image/jpeg,image/webp,image/svg+xml'

interface Props {
  especieId: number
}

// Imagen de la especie que sale en el banner de los documentos PDF (mitad
// derecha del encabezado). Una por especie. El preview se baja como Blob vía ky
// (no <img src> directo) para que adjunte X-Empresa-Id y resuelva la empresa
// activa correcta en multiempresa (FAS-DOC-IMG-R2-001).
export function EspecieImagenUpload({ especieId }: Props) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const inputRef = useRef<HTMLInputElement>(null)
  // version: fuerza el refetch del preview tras subir/eliminar.
  const [version, setVersion] = useState(0)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  const { data: blob } = useQuery({
    queryKey: ['especie-imagen', especieId, version],
    queryFn: () => especieImagenService.descargar(especieId),
    retry: false, // 404 = sin imagen, no reintentar
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!blob) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza object URL al blob
      setObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(blob)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])

  const uploadMutation = useMutation({
    mutationFn: (file: File) => especieImagenService.subir(especieId, file),
    onSuccess: () => {
      toast.success('Imagen actualizada')
      setVersion((v) => v + 1)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al subir la imagen'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => especieImagenService.eliminar(especieId),
    onSuccess: () => {
      toast.success('Imagen eliminada')
      setVersion((v) => v + 1)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar la imagen'),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    uploadMutation.mutate(file)
  }

  const hayImagen = !!objectUrl

  return (
    <div className='space-y-2'>
      <Label className='text-sm font-medium'>Imagen para documentos (banner)</Label>
      <div className='flex h-24 w-full items-center justify-center overflow-hidden rounded-md border bg-muted/30 p-2'>
        {hayImagen ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob local (object URL), no next/image
          <img src={objectUrl!} alt='Imagen de la especie' className='max-h-full max-w-full object-contain' />
        ) : (
          <div className='flex flex-col items-center gap-1 text-muted-foreground'>
            <Icons.media className='h-6 w-6 opacity-40' />
            <span className='text-xs'>Sin imagen</span>
          </div>
        )}
      </div>

      {puedeEscribir && (
        <div className='flex gap-2'>
          <input ref={inputRef} type='file' accept={MIMES_ACEPTADOS} className='hidden' onChange={handleFileChange} />
          <Button type='button' variant='outline' size='sm' onClick={() => inputRef.current?.click()} isLoading={uploadMutation.isPending}>
            <Icons.upload className='mr-1.5 h-3.5 w-3.5' />
            {hayImagen ? 'Cambiar' : 'Subir imagen'}
          </Button>
          {hayImagen && (
            <Button type='button' variant='ghost' size='sm' onClick={() => deleteMutation.mutate()} isLoading={deleteMutation.isPending}>
              <Icons.trash className='mr-1.5 h-3.5 w-3.5' />
              Eliminar
            </Button>
          )}
        </div>
      )}
      <p className='text-muted-foreground text-xs'>
        PNG, JPEG, WebP o SVG · máx. 2MB. Aparece en el encabezado (lado derecho) de los PDF de la especie.
      </p>
    </div>
  )
}
