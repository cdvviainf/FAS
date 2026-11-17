'use client'

import { useTemporada } from '@/contexts/temporada-context'
import { Icons } from '@/components/icons'

// La temporada del selector superior viaja en la cabecera X-Temporada-Id de
// cada request y la API rechaza los listados sin ella (2026-11-16,
// TEC-R2-002). El contenido de las pantallas no se monta hasta que el
// TemporadaProvider la haya fijado: así ninguna consulta de negocio sale sin
// temporada al entrar con el navegador vacío ni al cambiar de empresa. El
// sidebar y la barra superior (con el selector) no esperan.
export function EsperarTemporada({ children }: { children: React.ReactNode }) {
  const { isLoading } = useTemporada()
  if (isLoading) {
    return (
      <div className='flex flex-1 items-center justify-center p-8 text-muted-foreground'>
        <Icons.spinner className='h-5 w-5 animate-spin' />
      </div>
    )
  }
  return <>{children}</>
}
