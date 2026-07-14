import { MantenedorTable } from './mantenedor-table'
import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

// useQuery (not useSuspenseQuery) inside MantenedorTable ensures no SSR fetch.
// Docker: localhost:3001 is unreachable from within the web container.

interface MantenedorListingProps {
  recurso: string
  titulo: string
  extraColumns?: ColumnDef<MantenedorSimple>[]
  renderEditSheet?: (props: { item: MantenedorSimple; open: boolean; onOpenChange: (v: boolean) => void }) => React.ReactNode
}

export default function MantenedorListing({
  recurso,
  titulo,
  extraColumns,
  renderEditSheet
}: MantenedorListingProps) {
  return <MantenedorTable recurso={recurso} titulo={titulo} extraColumns={extraColumns} renderEditSheet={renderEditSheet} />
}
