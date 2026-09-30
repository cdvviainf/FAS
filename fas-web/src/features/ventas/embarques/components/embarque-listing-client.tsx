'use client'

import { useQuery } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger, parseAsString } from 'nuqs'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDataTable } from '@/hooks/use-data-table'
import { embarquesListOptions } from '../queries'
import { embarqueColumns } from './embarque-columns'
import { ESTADO_EMBARQUE_LISTADO_LABELS } from '../types'
import type { EstadoEmbarqueListado } from '../types'

export function EmbarqueListingClient() {
  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
    estado: parseAsString.withDefault(''),
    // Mismo nombre/formato de clave que useDataTable (SORT_KEY='sort', JSON
    // [{id,desc}]) — se lee acá como string crudo para pasárselo tal cual al
    // backend, sin duplicar el parser de sorting de la tabla.
    sort: parseAsString.withDefault(''),
  })

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.estado ? { estado: params.estado } : {}),
    ...(params.sort ? { sort: params.sort } : {}),
  }
  const { data, isPending } = useQuery(embarquesListOptions(filters))

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0

  const { table } = useDataTable({
    data: data?.data ?? [],
    columns: embarqueColumns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] },
    },
  })

  if (isPending) {
    return <DataTableSkeleton columnCount={8} rowCount={10} />
  }

  return (
    <div className='flex flex-1 flex-col space-y-3'>
      <p className='text-sm text-muted-foreground'>
        Los Embarques se generan desde el menú de acciones de un Cierre Comercial (&quot;Solicitar espacio&quot;).
      </p>
      <div className='max-w-[220px] space-y-1.5'>
        <Label className='text-[10.5px] tracking-wide uppercase'>Estado</Label>
        <Select
          value={params.estado || 'TODOS'}
          onValueChange={(v) => setParams({ estado: v === 'TODOS' ? '' : v, page: 1 })}
        >
          <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value='TODOS'>Todos</SelectItem>
            {(Object.keys(ESTADO_EMBARQUE_LISTADO_LABELS) as EstadoEmbarqueListado[]).map((e) => (
              <SelectItem key={e} value={e}>{ESTADO_EMBARQUE_LISTADO_LABELS[e]}</SelectItem>
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
