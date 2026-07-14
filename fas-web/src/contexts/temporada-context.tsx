'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'

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
  const [temporada, setTemporadaState] = useState<TemporadaItem | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Fetch predeterminada from API
  const { data: predeterminada, isLoading } = useQuery({
    queryKey: ['temporadas', 'predeterminada'],
    queryFn: () => api.get('config/temporadas/predeterminada').json<TemporadaItem | null>(),
    staleTime: 60_000,
  })

  // Fetch all temporadas to validate stored selection is still active
  const temporadasQueries = createMantenedorQueries('temporadas')
  const { data: temporadasData } = useQuery(temporadasQueries.listOptions({ limit: 100, soloActivos: true }))
  const temporadasActivas = temporadasData?.data ?? []

  // Initialize: use localStorage if the stored temporada is still active; otherwise use predeterminada API
  useEffect(() => {
    if (initialized) return
    if (isLoading || !temporadasData) return

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
  }, [isLoading, predeterminada, initialized, temporadasData, temporadasActivas])

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
