import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Grupo de Defecto'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

// Grupo de Defecto es la clasificación "Calidad/Condición" de los defectos
// (2026-10-06, 2 niveles: Grupo -> Defecto). Mantenedor plano, sin FK.
export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Grupo de Defecto'
      pageDescription='Grupos de defectos (p. ej. Calidad, Condición) para los reclamos'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='grupos-defecto' titulo='Grupo de Defecto' />}
    >
      <MantenedorListing recurso='grupos-defecto' titulo='Grupo de Defecto' />
    </PageContainer>
  )
}
