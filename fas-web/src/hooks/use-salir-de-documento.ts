'use client'

import { useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useMenuAcceso } from '@/contexts/menu-acceso-context'

// Al cambiar de empresa o temporada estando DENTRO de un documento (ver, editar
// o crear: /nueva, /[id], /[id]/editar…), el documento deja de corresponder al
// contexto nuevo → se vuelve al Dashboard (2026-11-06). En un listado u otra
// pantalla del menú no se navega: la tabla se refresca sola.
//
// "Dentro de un documento" = la ruta es una sub-ruta de una pantalla del menú
// (pathname más largo que la ruta del ItemMenu que la cubre), o no la cubre
// ningún ítem pero tiene un segmento /nueva o numérico.
export function useSalirDeDocumento() {
  const pathname = usePathname()
  const router = useRouter()
  const { items } = useMenuAcceso()

  return useCallback(() => {
    let rutaItem: string | null = null
    for (const it of items) {
      if (it.esAccion || !it.ruta || it.ruta === '/dashboard') continue
      if (pathname === it.ruta || pathname.startsWith(`${it.ruta}/`)) {
        if (!rutaItem || it.ruta.length > rutaItem.length) rutaItem = it.ruta
      }
    }
    const enDocumento = rutaItem
      ? pathname !== rutaItem
      : pathname.split('/').some((s) => s === 'nueva' || s === 'nuevo' || /^\d+$/.test(s))
    if (enDocumento) router.push('/dashboard')
  }, [items, pathname, router])
}
