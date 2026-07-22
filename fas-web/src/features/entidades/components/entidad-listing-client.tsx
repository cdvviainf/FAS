'use client'

import { useQuery } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { entidadesListOptions } from '../queries'
import { entidadColumns } from './entidad-columns'
import type { TipoEntidad } from '../types'
import { TIPO_ENTIDAD_LABELS, TIPOS_ENTIDAD_ORDEN } from '../types'

export function EntidadListingClient() {
  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
    q: parseAsString,
    tipo: parseAsStringEnum<TipoEntidad>(Object.keys(TIPO_ENTIDAD_LABELS) as TipoEntidad[]),
  })

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.q ? { q: params.q } : {}),
    ...(params.tipo ? { tipo: params.tipo } : {}),
  }

  const { data, isPending } = useQuery(entidadesListOptions(filters))

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0

  const { table } = useDataTable({
    data: data?.data ?? [],
    columns: entidadColumns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] },
    },
  })

  if (isPending) {
    return <DataTableSkeleton columnCount={6} rowCount={10} />
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <Select
          value={params.tipo ?? ''}
          onValueChange={(v) => setParams({ tipo: (v as TipoEntidad) || null, page: 1 })}
        >
          <SelectTrigger className='w-[200px] h-8 text-sm'>
            <SelectValue placeholder='Todos los tipos' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=''>Todos los tipos</SelectItem>
            {TIPOS_ENTIDAD_ORDEN.map((t) => (
              <SelectItem key={t} value={t}>{TIPO_ENTIDAD_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable table={table}>
        <DataTableToolbar table={table} />
      </DataTable>
    </div>
  )
}
