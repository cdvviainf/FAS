'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { useEmpresa } from '@/contexts/empresa-context'

interface TemporadaItem {
  id: number
  codigo: string
  descripcion: string
}

interface TemporadaContextValue {
  temporada: TemporadaItem | null
  setTemporada: (t: TemporadaItem) => void
  isLoading: boolean
}

const TemporadaContext = createContext<TemporadaContextValue>({
  temporada: null,
  setTemporada: () => {},
  isLoading: true,
})

const STORAGE_KEY = 'fas_temporada'

export function TemporadaProvider({ children }: { children: React.ReactNode }) {
  const { empresaActiva } = useEmpresa()
  const [temporada, setTemporadaState] = useState<TemporadaItem | null>(null)
  const [initialized, setInitialized] = useState(false)
  const empresaIdRef = useRef<number | null | undefined>(undefined)

  // Decisión #8 (Docs/empresas.md): cambiar de empresa resetea la Temporada a
  // la predeterminada de la nueva empresa. Hoy Temporada sigue siendo un
  // mantenedor global (empresaId llega recién en Fase 2/3), así que este
  // reset todavía no cambia qué temporada se obtiene — pero deja el mecanismo
  // listo para cuando el endpoint de predeterminada quede scoped por empresa.
  useEffect(() => {
    const empresaId = empresaActiva?.id ?? null
    if (empresaIdRef.current === undefined) {
      empresaIdRef.current = empresaId
      return
    }
    if (empresaIdRef.current === empresaId) return
    empresaIdRef.current = empresaId
    localStorage.removeItem(STORAGE_KEY)
    setTemporadaState(null)
    setInitialized(false)
  }, [empresaActiva])

  // Fetch predeterminada from API
  // empresaId en la key: Temporada es por empresa; sin él, al volver a una
  // empresa se reusaba la predeterminada cacheada de la otra.
  const { data: predeterminada, isLoading, isFetching: fetchingPred } = useQuery({
    queryKey: ['temporadas', 'predeterminada', empresaActiva?.id ?? null],
    queryFn: () => api.get('config/temporadas/predeterminada').json<TemporadaItem | null>(),
    staleTime: 60_000,
  })

  // Fetch all temporadas to validate stored selection is still active
  const temporadasQueries = createMantenedorQueries('temporadas')
  const { data: temporadasData, isFetching: fetchingLista } = useQuery(temporadasQueries.listOptions({ limit: 100, soloActivos: true }))
  const temporadasActivas = temporadasData?.data ?? []

  // Initialize: use localStorage if the stored temporada is still active; otherwise use predeterminada API
  useEffect(() => {
    if (initialized) return
    // Esperar datos FRESCOS: tras cambiar de empresa no inicializar con la
    // respuesta de la empresa anterior mientras se refetchea.
    if (isLoading || !temporadasData || fetchingPred || fetchingLista) return

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as TemporadaItem
        const sigueActiva = temporadasActivas.some((t) => t.id === parsed.id)
        if (sigueActiva) {
          setTemporadaState(parsed)
          setInitialized(true)
          return
        } else {
          // Temporada guardada ya no está activa; limpiar y usar predeterminada
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }

    if (predeterminada) {
      setTemporadaState(predeterminada)
    }
    setInitialized(true)
  }, [isLoading, predeterminada, initialized, temporadasData, temporadasActivas, fetchingPred, fetchingLista])

  const setTemporada = useCallback((t: TemporadaItem) => {
    setTemporadaState(t)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
  }, [])

  return (
    <TemporadaContext.Provider value={{ temporada, setTemporada, isLoading: !initialized }}>
      {children}
    </TemporadaContext.Provider>
  )
}

export function useTemporada() {
  return useContext(TemporadaContext)
}
