import PageContainer from '@/components/layout/page-container';
import { searchParamsCache } from '@/lib/searchparams';
import { SearchParams } from 'nuqs/server';
import RecetaListingPage from '@/features/recetas/components/receta-listing';
import { RecetaFormSheetTrigger } from '@/features/recetas/components/receta-form-sheet';

export const metadata = {
  title: 'FAS — Recetas'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle='Recetas de Embalaje'
      pageDescription='Recetas que definen los materiales y servicios necesarios para producir cada embalaje.'
      pageHeaderAction={<RecetaFormSheetTrigger />}
    >
      <RecetaListingPage />
    </PageContainer>
  );
}
