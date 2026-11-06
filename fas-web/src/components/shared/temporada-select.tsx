'use client'

import { useQuery } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

const temporadasQueries = createMantenedorQueries('temporadas')

// Selector de Temporada de documentos (2026-11-06): Cierre, OC de fruta,
// Instructivo de Embalaje y Recepción. Ofrece las temporadas NO bloqueadas de la
// empresa activa; si el documento ya tiene una que luego se bloqueó, se sigue
// mostrando (marcada) para no perder el valor al editar.
export function TemporadaSelect({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange: (id: number) => void
  disabled?: boolean
}) {
  const { data } = useQuery(temporadasQueries.listOptions({ limit: 200 }))
  const temporadas = ((data?.data ?? []) as MantenedorSimple[]).filter((t) => !t.bloqueado || t.id === value)

  return (
    <Select value={value ? String(value) : ''} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder='Seleccionar temporada...' />
      </SelectTrigger>
      <SelectContent>
        {temporadas.map((t) => (
          <SelectItem key={t.id} value={String(t.id)}>
            {t.codigo} — {t.descripcion}
            {t.bloqueado ? ' (bloqueada)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
