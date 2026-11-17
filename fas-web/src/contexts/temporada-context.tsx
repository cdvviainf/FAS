'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()
  const [temporada, setTemporadaState] = useState<TemporadaItem | null>(null)
  const [initialized, setInitialized] = useState(false)
  // Empresa para la que se fijó la temporada actual (TEC-R3-003): si la empresa
  // activa cambia, el provider deja de estar "listo" en ESE MISMO render (no
  // recién en el efecto de abajo), así EsperarTemporada desmonta las pantallas
  // antes de que alguna vuelva a pedir datos con la temporada de otra empresa.
  const [empresaDeTemporada, setEmpresaDeTemporada] = useState<number | null | undefined>(undefined)
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

    let elegida: TemporadaItem | null = null
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as TemporadaItem
        if (temporadasActivas.some((t) => t.id === parsed.id)) elegida = parsed
      } catch {
        /* valor corrupto: se descarta abajo */
      }
    }
    // Temporada guardada ya no activa (o ilegible) → la predeterminada.
    if (!elegida) elegida = predeterminada ?? null

    // Persistida siempre ANTES de marcar inicializado (2026-11-16): el cliente
    // HTTP lee de aquí la temporada que manda en la cabecera X-Temporada-Id, y
    // EsperarTemporada recién monta las pantallas cuando initialized = true.
    if (elegida) localStorage.setItem(STORAGE_KEY, JSON.stringify(elegida))
    else localStorage.removeItem(STORAGE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicialización desde localStorage/API (sistema externo), una sola vez por empresa
    setTemporadaState(elegida)
    setInitialized(true)
    setEmpresaDeTemporada(empresaActiva?.id ?? null)
    // Tras (re)inicializar —p. ej. al cambiar de empresa, cuando el reset de
    // queries pudo refetchear con la temporada anterior— se refresca todo lo
    // de negocio con la cabecera nueva (TEC-R2-002). Se excluyen las queries de
    // temporadas (las de este provider) y las de sesión (config/me).
    void queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] !== 'temporadas' && !(q.queryKey[0] === 'config' && q.queryKey[1] === 'me'),
    })
  }, [isLoading, predeterminada, initialized, temporadasData, temporadasActivas, fetchingPred, fetchingLista, queryClient, empresaActiva])

  const setTemporada = useCallback((t: TemporadaItem) => {
    setTemporadaState(t)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
    // La temporada viaja en la cabecera de cada request (2026-11-16): al
    // cambiarla, todo lo cargado pasa a ser de otra temporada → se refresca.
    void queryClient.invalidateQueries()
  }, [queryClient])

  // Lista solo si la temporada se fijó para la empresa activa de ESTE render.
  const listo = initialized && empresaDeTemporada === (empresaActiva?.id ?? null)

  return (
    <TemporadaContext.Provider value={{ temporada, setTemporada, isLoading: !listo }}>
      {children}
    </TemporadaContext.Provider>
  )
}

export function useTemporada() {
  return useContext(TemporadaContext)
}
