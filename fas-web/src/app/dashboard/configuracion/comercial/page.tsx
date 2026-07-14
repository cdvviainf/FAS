import PageContainer from '@/components/layout/page-container';
import { searchParamsCache } from '@/lib/searchparams';
import { SearchParams } from 'nuqs/server';
import MercadoListingPage from '@/features/mercados/components/mercado-listing';
import { MercadoFormSheetTrigger } from '@/features/mercados/components/mercado-form-sheet';

export const metadata = {
  title: 'FAS — Mercados'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle='Mercados'
      pageDescription='Mercados de exportación agrupados por región geográfica.'
      pageHeaderAction={<MercadoFormSheetTrigger />}
    >
      <MercadoListingPage />
    </PageContainer>
  );
}
