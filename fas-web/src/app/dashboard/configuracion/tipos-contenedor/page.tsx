import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Tipo de Contenedor'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Tipo de Contenedor'
      pageDescription="Tipos de contenedor del Embarque (20' Reefer, 40' HC Reefer…). Para AGL360 se traducen en Configuración → Integraciones."
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='tipos-contenedor' titulo='Tipo de Contenedor' />}
    >
      <MantenedorListing recurso='tipos-contenedor' titulo='Tipo de Contenedor' />
    </PageContainer>
  )
}
