'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Combobox } from '@/components/ui/combobox'
import { embarquesService } from '@/features/ventas/embarques/service'
import { estaDespachado } from '@/features/ventas/embarques/types'

interface NuevaProformaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Selector de Embarque para emitir su Proforma (cobranza.md, 2026-09-24) —
// sin endpoint de búsqueda dedicado por folio, se trae el listado COMPLETO
// (todas las páginas, tope 500 por página — límite máximo del endpoint) en
// vez de una sola página filtrada en el cliente (FAS-PROF-EXP-008, QA ronda
// 3: con más de 200 Embarques, algunos despachados quedaban inalcanzables
// desde este selector). Solo se ofrecen los ya despachados — emitir Proforma
// antes de despachar no tiene sentido de negocio (la fruta ni siquiera salió).
async function fetchTodosLosEmbarques() {
  const limit = 500
  const primera = await embarquesService.list({ limit, page: 1 })
  if (primera.meta.totalPages <= 1) return primera.data
  const resto = await Promise.all(
    Array.from({ length: primera.meta.totalPages - 1 }, (_, i) => embarquesService.list({ limit, page: i + 2 })),
  )
  return [primera.data, ...resto.map((r) => r.data)].flat()
}

export function NuevaProformaDialog({ open, onOpenChange }: NuevaProformaDialogProps) {
  const router = useRouter()
  const [embarqueId, setEmbarqueId] = useState<string | null>(null)

  const { data, isPending } = useQuery({
    queryKey: ['embarques-despachados-para-proforma'],
    queryFn: fetchTodosLosEmbarques,
    enabled: open,
    staleTime: 30_000,
  })
  const opciones = (data ?? [])
    .filter(estaDespachado)
    .map((e) => ({ value: String(e.id), label: e.numeroInstructivo }))

  function seleccionar(value: string) {
    setEmbarqueId(value)
    router.push(`/dashboard/facturacion/exportacion/${value}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Nueva Proforma</DialogTitle>
          <DialogDescription>Selecciona el Embarque despachado para el que quieres emitir la Proforma.</DialogDescription>
        </DialogHeader>
        <Combobox
          options={opciones}
          value={embarqueId}
          onChange={seleccionar}
          placeholder={isPending ? 'Cargando...' : 'Selecciona un Embarque'}
          searchPlaceholder='Buscar por folio...'
          emptyText='Sin Embarques despachados disponibles.'
        />
      </DialogContent>
    </Dialog>
  )
}
