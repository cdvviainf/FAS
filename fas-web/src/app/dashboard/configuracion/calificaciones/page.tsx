import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Calificación'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Calificación'
      pageDescription='Calificaciones de calidad utilizadas en Solicitudes de Inspección (ej. B1)'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='calificaciones' titulo='Calificación' />}
    >
      <MantenedorListing recurso='calificaciones' titulo='Calificación' />
    </PageContainer>
  )
}
