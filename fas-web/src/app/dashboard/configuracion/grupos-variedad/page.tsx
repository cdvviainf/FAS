import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { GrupoVariedadFormSheetTrigger } from '@/features/grupos-variedad/components/grupo-variedad-form-sheet'
import { grupoVariedadExtraColumns } from '@/features/grupos-variedad/components/grupo-variedad-columns'

export const metadata = {
  title: 'FAS — Grupos de Variedad'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Grupos de Variedad'
      pageDescription='Agrupaciones de variedades dentro de una especie (ej: Uva Sin Semilla, Uva Con Semilla).'
      pageHeaderAction={<GrupoVariedadFormSheetTrigger />}
    >
      <MantenedorListing recurso='grupos-variedad' titulo='Grupo de Variedad' extraColumns={grupoVariedadExtraColumns} />
    </PageContainer>
  )
}
