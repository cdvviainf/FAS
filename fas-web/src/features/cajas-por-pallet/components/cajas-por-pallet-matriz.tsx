'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { cajasPorPalletService } from '../service'

const ITEM = 'CONFIG_CAJAS_POR_PALLET'
const tiposPalletService = createMantenedorService('tipos-pallet')
const especiesService = createMantenedorService('especies')

export function CajasPorPalletMatriz() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [tipoPalletId, setTipoPalletId] = useState<number>(0)
  const [especieId, setEspecieId] = useState<number>(0)
  const [valores, setValores] = useState<Record<number, string>>({})

  const { data: tiposPalletData } = useQuery({
    queryKey: ['tipos-pallet-cpp'],
    queryFn: () => tiposPalletService.list({ limit: 200 }),
    staleTime: 5 * 60_000,
  })
  const { data: especiesData } = useQuery({
    queryKey: ['especies-cpp'],
    queryFn: () => especiesService.list({ limit: 300 }),
    staleTime: 5 * 60_000,
  })

  const habilitado = tipoPalletId > 0 && especieId > 0
  const matrizKey = ['cajas-por-pallet-matriz', especieId, tipoPalletId]
  const { data: matrizData, isFetching } = useQuery({
    queryKey: matrizKey,
    queryFn: () => cajasPorPalletService.matriz(especieId, tipoPalletId),
    enabled: habilitado,
  })
  const filas = matrizData?.data ?? []

  // Sincroniza los inputs locales cuando llega la matriz.
  useEffect(() => {
    if (matrizData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratar inputs al cargar la matriz
      setValores(Object.fromEntries(matrizData.data.map((r) => [r.articuloId, r.cajasPorPallet != null ? String(r.cajasPorPallet) : ''])))
    }
  }, [matrizData])

  const guardar = useMutation({
    mutationFn: ({ articuloId, cantidad }: { articuloId: number; cantidad: number }) =>
      cajasPorPalletService.upsert(articuloId, tipoPalletId, cantidad),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: matrizKey })
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo guardar'),
  })

  function onBlurCantidad(articuloId: number, valorServidor: number | null) {
    const raw = valores[articuloId]?.trim() ?? ''
    if (raw === '') return
    const n = Number(raw)
    if (!Number.isInteger(n) || n <= 0) {
      toast.error('La cantidad debe ser un entero mayor a 0')
      return
    }
    if (n === valorServidor) return // sin cambios
    guardar.mutate({ articuloId, cantidad: n })
  }

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-1.5'>
          <Label>Tipo de Pallet</Label>
          <Select value={tipoPalletId ? String(tipoPalletId) : ''} onValueChange={(v) => setTipoPalletId(Number(v))}>
            <SelectTrigger className='w-full'><SelectValue placeholder='Seleccionar tipo de pallet...' /></SelectTrigger>
            <SelectContent>
              {(tiposPalletData?.data ?? []).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.codigo} — {t.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label>Especie</Label>
          <Select value={especieId ? String(especieId) : ''} onValueChange={(v) => setEspecieId(Number(v))}>
            <SelectTrigger className='w-full'><SelectValue placeholder='Seleccionar especie...' /></SelectTrigger>
            <SelectContent>
              {(especiesData?.data ?? []).map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.codigo} — {e.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!habilitado ? (
        <p className='text-muted-foreground text-sm'>Selecciona un tipo de pallet y una especie para ver los embalajes.</p>
      ) : isFetching && filas.length === 0 ? (
        <p className='text-muted-foreground text-sm'>Cargando embalajes...</p>
      ) : filas.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No hay embalajes asociados a esta especie.</p>
      ) : (
        <div className='overflow-x-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artículo</TableHead>
                <TableHead className='w-48 text-right'>Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((r) => (
                <TableRow key={r.articuloId}>
                  <TableCell>{r.codigo} — {r.descripcion}</TableCell>
                  <TableCell className='text-right'>
                    <Input
                      type='number'
                      min={1}
                      className='text-right'
                      disabled={!puedeEscribir}
                      value={valores[r.articuloId] ?? ''}
                      onChange={(e) => setValores((v) => ({ ...v, [r.articuloId]: e.target.value }))}
                      onBlur={() => onBlurCantidad(r.articuloId, r.cajasPorPallet)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
