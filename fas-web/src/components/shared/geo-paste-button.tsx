'use client'

import { Button } from '@/components/ui/button'
import { IconClipboard } from '@tabler/icons-react'
import { toast } from 'sonner'
import { leerCoordenadasDelPortapapeles, type Coordenadas } from '@/lib/geo-paste'

interface GeoPasteButtonProps {
  onPegado: (coords: Coordenadas) => void
}

// Botón compartido para pegar geolocalización (coordenadas planas o link de
// Google Maps con lat/lng visibles) en cualquier mantenedor con campos de
// latitud/longitud.
export function GeoPasteButton({ onPegado }: GeoPasteButtonProps) {
  async function handleClick() {
    try {
      const coords = await leerCoordenadasDelPortapapeles()
      if (coords) {
        onPegado(coords)
        toast.success('Coordenadas pegadas correctamente')
      } else {
        toast.error('Formato no reconocido. Copia coordenadas (lat, lng) o un link de Google Maps con la ubicación')
      }
    } catch {
      toast.error('No se pudo leer el portapapeles')
    }
  }

  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      className='h-7 px-2 text-xs gap-1'
      onClick={handleClick}
      title='Pegar coordenadas o link de Google Maps'
    >
      <IconClipboard className='h-3.5 w-3.5' />
      Pegar coords
    </Button>
  )
}
