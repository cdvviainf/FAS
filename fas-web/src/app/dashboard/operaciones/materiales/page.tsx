import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { searchParamsCache } from '@/lib/searchparams';
import { cn } from '@/lib/utils';
import { SearchParams } from 'nuqs/server';
import ArticuloListingPage from '@/features/materiales/components/articulo-listing';
import { ArticuloFormSheetTrigger } from '@/features/materiales/components/articulo-form-sheet';

export const metadata = {
  title: 'FAS — Materiales'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle='Materiales y Embalajes'
      pageDescription='Catálogo de artículos: embalajes, envases, materiales y servicios.'
      pageHeaderAction={<ArticuloFormSheetTrigger />}
    >
      <ArticuloListingPage />
    </PageContainer>
  );
}
