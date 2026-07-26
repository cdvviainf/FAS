'use client'

import { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type NivelAcceso = 'SIN_ACCESO' | 'LECTURA' | 'TOTAL'

interface ItemMenuAcceso {
  codigo: string
  nombre: string
  seccion: string
  ruta: string | null
  esAccion: boolean
  orden: number
  nivel: NivelAcceso
}

interface MenuAccesoContextValue {
  accesos: Map<string, NivelAcceso>
  items: ItemMenuAcceso[]
  isLoading: boolean
}

const MenuAccesoContext = createContext<MenuAccesoContextValue>({
  accesos: new Map(),
  items: [],
  isLoading: true,
})

export function MenuAccesoProvider({ children }: { children: React.ReactNode }) {
  // Sin sesión (ej. páginas de login) devuelve 401 — se trata como "sin accesos"
  // en vez de reintentar o mostrar error.
  const { data, isLoading } = useQuery({
    queryKey: ['config', 'me', 'menu'],
    queryFn: () => api.get('config/me/menu').json<ItemMenuAcceso[]>(),
    staleTime: 5 * 60_000,
    retry: false,
    throwOnError: false,
  })

  const items = useMemo(() => data ?? [], [data])
  const accesos = useMemo(() => new Map(items.map((item) => [item.codigo, item.nivel])), [items])

  return (
    <MenuAccesoContext.Provider value={{ accesos, items, isLoading }}>
      {children}
    </MenuAccesoContext.Provider>
  )
}

export function useMenuAcceso() {
  return useContext(MenuAccesoContext)
}
