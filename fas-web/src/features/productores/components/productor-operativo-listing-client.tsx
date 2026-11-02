'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger, parseAsString } from 'nuqs'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Icons } from '@/components/icons'
import { usePuedeLeer } from '@/hooks/use-item-acceso'
import { documentosService } from '@/features/documentos/service'
import { productoresListOptions } from '../queries'
import type { ProductorListItem } from '../types'

function ProductorCellAction({ productor }: { productor: ProductorListItem }) {
  const router = useRouter()
  const [descargando, setDescargando] = useState(false)
  // Contrato y Cuenta Corriente tienen permiso propio (PROD_CONTRATO /
  // PROD_CTA_CTE): ocultar la acción si el perfil no tiene ni LECTURA, para no
  // ofrecer una navegación que el backend rechazaría con 403 (igual que los
  // tabs en ProductorFichaClient).
  const puedeVerContrato = usePuedeLeer('PROD_CONTRATO')
  const puedeVerCtaCte = usePuedeLeer('PROD_CTA_CTE')

  const irA = (tab: string) => router.push(`/dashboard/productores/${productor.id}?tab=${tab}`)

  async function descargarFicha() {
    setDescargando(true)
    try {
      await documentosService.abrirPdf('ficha-productor', productor.id)
    } catch {
      toast.error('No se pudo descargar la ficha')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='h-8 w-8 p-0'>
          <span className='sr-only'>Abrir menú</span>
          <Icons.ellipsis className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => irA('predios')}>
          <Icons.post className='mr-2 h-4 w-4' />
          Ver Predios
        </DropdownMenuItem>
        {puedeVerContrato && (
          <DropdownMenuItem onClick={() => irA('contrato')}>
            <Icons.post className='mr-2 h-4 w-4' />
            Ver Contrato
          </DropdownMenuItem>
        )}
        {puedeVerCtaCte && (
          <DropdownMenuItem onClick={() => irA('cuenta-corriente')}>
            <Icons.billing className='mr-2 h-4 w-4' />
            Ver Cuenta Corriente
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={descargarFicha} disabled={descargando}>
          <Icons.download className='mr-2 h-4 w-4' />
          Descargar Ficha PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ProductorOperativoListingClient() {
  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
    q: parseAsString,
  })

  // keepPreviousData: evita desmontar el buscador al tipear (ver mantenedor-table).
  const { data, isPending } = useQuery({ ...productoresListOptions({ page: params.page, limit: params.perPage, q: params.q ?? undefined }), placeholderData: keepPreviousData })

  const columns = useMemo<ColumnDef<ProductorListItem>[]>(() => [
    {
      accessorKey: 'codigo',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Código' />,
      cell: ({ row }) => <span className='font-medium'>{row.original.codigo}</span>,
    },
    { accessorKey: 'descripcion', header: 'Nombre' },
    { accessorKey: 'razonSocial', header: 'Razón Social' },
    {
      id: 'activo',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.activo ? 'default' : 'secondary'}>
          {row.original.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      size: 50,
      cell: ({ row }) => <ProductorCellAction productor={row.original} />,
    },
  ], [])

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0
  const { table } = useDataTable({
    data: data?.data ?? [],
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: { columnPinning: { right: ['actions'] } },
  })

  if (isPending) return <DataTableSkeleton columnCount={5} rowCount={10} />

  return (
    <div className='flex flex-1 flex-col space-y-3'>
      <Input
        placeholder='Buscar productor...'
        value={params.q ?? ''}
        onChange={(e) => setParams({ q: e.target.value || null, page: 1 })}
        className='h-9 w-[280px]'
      />
      <DataTable table={table} />
    </div>
  )
}
