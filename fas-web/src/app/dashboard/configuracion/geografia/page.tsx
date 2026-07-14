import PageContainer from '@/components/layout/page-container';
import { searchParamsCache } from '@/lib/searchparams';
import { SearchParams } from 'nuqs/server';
import RegionListingPage from '@/features/regiones/components/region-listing';
import { RegionFormSheetTrigger } from '@/features/regiones/components/region-form-sheet';

export const metadata = {
  title: 'FAS — Regiones'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle='Regiones'
      pageDescription='Administración de regiones del país para la operación.'
      pageHeaderAction={<RegionFormSheetTrigger />}
    >
      <RegionListingPage />
    </PageContainer>
  );
}
