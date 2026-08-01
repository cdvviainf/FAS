'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface EmpresaItem {
  id: number
  codigo: string
  razonSocial: string
}

interface MisEmpresasResponse {
  empresas: EmpresaItem[]
  empresaPredeterminadaId: number | null
}

interface EmpresaContextValue {
  empresaActiva: EmpresaItem | null
  empresas: EmpresaItem[]
  setEmpresaActiva: (empresa: EmpresaItem) => void
  isLoading: boolean
}

const EmpresaContext = createContext<EmpresaContextValue>({
  empresaActiva: null,
  empresas: [],
  setEmpresaActiva: () => {},
  isLoading: true,
})

const STORAGE_KEY = 'fas_empresa_id'

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [empresaActiva, setEmpresaActivaState] = useState<EmpresaItem | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Sin sesión (ej. páginas de login) devuelve 401 — se trata como "sin
  // empresas" en vez de reintentar o mostrar error, igual que MenuAcceso.
  const { data, isLoading } = useQuery({
    queryKey: ['config', 'me', 'empresas'],
    queryFn: () => api.get('config/me/empresas').json<MisEmpresasResponse>(),
    staleTime: 5 * 60_000,
    retry: false,
    throwOnError: false,
  })

  const empresas = data?.empresas ?? []

  // Inicialización: localStorage (si el usuario sigue siendo miembro) →
  // predeterminada del backend → auto-selección si solo hay una empresa
  // disponible (decisión #7, Docs/empresas.md).
  useEffect(() => {
    if (initialized) return
    if (isLoading) return

    const storedRaw = localStorage.getItem(STORAGE_KEY)
    const storedId = storedRaw ? Number(storedRaw) : null
    const stored = storedId ? empresas.find((e) => e.id === storedId) : undefined
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmpresaActivaState(stored)
      setInitialized(true)
      return
    }
    if (storedRaw) localStorage.removeItem(STORAGE_KEY)

    const predeterminadaId = data?.empresaPredeterminadaId
    const predeterminada = predeterminadaId ? empresas.find((e) => e.id === predeterminadaId) : undefined
    if (predeterminada) {
      setEmpresaActivaState(predeterminada)
    } else if (empresas.length === 1) {
      setEmpresaActivaState(empresas[0])
    }
    setInitialized(true)
  }, [isLoading, data, empresas, initialized])

  // Persiste toda selección de empresa activa —de inicialización (stored,
  // predeterminada, auto-selección) o cambio manual— para que lib/api.ts
  // (singleton fuera del árbol de React) pueda leerla de forma síncrona.
  useEffect(() => {
    if (empresaActiva) localStorage.setItem(STORAGE_KEY, String(empresaActiva.id))
  }, [empresaActiva])

  const setEmpresaActiva = useCallback(
    (empresa: EmpresaItem) => {
      // Escritura síncrona ANTES de invalidar: invalidateQueries() puede
      // disparar refetches de inmediato, y lib/api.ts lee el header desde
      // localStorage en el momento del request — si el efecto de arriba
      // todavía no corrió, esos refetches saldrían con la empresa anterior.
      localStorage.setItem(STORAGE_KEY, String(empresa.id))
      setEmpresaActivaState(empresa)
      // Decisión #8: cambiar de empresa invalida todo el cache de TanStack
      // Query. La Temporada activa se resetea en su propio provider al
      // detectar el cambio de empresaActiva (ver TemporadaProvider).
      queryClient.invalidateQueries()
    },
    [queryClient],
  )

  return (
    <EmpresaContext.Provider
      value={{ empresaActiva, empresas, setEmpresaActiva, isLoading: !initialized }}
    >
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  return useContext(EmpresaContext)
}
