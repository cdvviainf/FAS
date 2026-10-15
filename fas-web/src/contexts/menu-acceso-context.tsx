'use client'

import { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type NivelAcceso = 'SIN_ACCESO' | 'LECTURA' | 'TOTAL'

export interface ItemMenuAcceso {
  codigo: string
  nombre: string
  seccion: string
  ruta: string | null
  esAccion: boolean
  orden: number
  nivel: NivelAcceso
}

// Resuelve el ItemMenu más específico (ruta más larga que matchea) para un
// pathname dado — coincidencia exacta o por prefijo de segmento (para
// sub-rutas como /nueva o /[id]). Ignora ítems de acción (sin ruta) y el
// ítem raíz "/dashboard" (no debe actuar como comodín de toda la app).
// Retorna null si ningún ItemMenu cubre esa ruta — el llamador decide el
// comportamiento por defecto (hoy: permitir, hasta completar el catálogo).
export function resolverNivelPorRuta(pathname: string, items: ItemMenuAcceso[]): NivelAcceso | null {
  let mejor: ItemMenuAcceso | null = null
  for (const item of items) {
    if (item.esAccion || !item.ruta || item.ruta === '/dashboard') continue
    const coincide = pathname === item.ruta || pathname.startsWith(`${item.ruta}/`)
    if (!coincide) continue
    if (!mejor || item.ruta.length > (mejor.ruta as string).length) mejor = item
  }
  return mejor?.nivel ?? null
}

interface MenuAccesoContextValue {
  accesos: Map<string, NivelAcceso>
  items: ItemMenuAcceso[]
  isLoading: boolean
  // Error al cargar /me/menu: se trata como fail-closed (no se asume acceso) —
  // QA-MENU-003. El sidebar no muestra ítems y el route-guard no renderiza
  // contenido protegido.
  isError: boolean
}

const MenuAccesoContext = createContext<MenuAccesoContextValue>({
  accesos: new Map(),
  items: [],
  isLoading: true,
  isError: false,
})

export function MenuAccesoProvider({ children }: { children: React.ReactNode }) {
  // Sin sesión (ej. páginas de login) devuelve 401 — se trata como "sin accesos"
  // (fail-closed) en vez de reintentar.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['config', 'me', 'menu'],
    queryFn: () => api.get('config/me/menu').json<ItemMenuAcceso[]>(),
    staleTime: 5 * 60_000,
    retry: false,
    throwOnError: false,
  })

  const items = useMemo(() => data ?? [], [data])
  const accesos = useMemo(() => new Map(items.map((item) => [item.codigo, item.nivel])), [items])

  return (
    <MenuAccesoContext.Provider value={{ accesos, items, isLoading, isError }}>
      {children}
    </MenuAccesoContext.Provider>
  )
}

export function useMenuAcceso() {
  return useContext(MenuAccesoContext)
}
