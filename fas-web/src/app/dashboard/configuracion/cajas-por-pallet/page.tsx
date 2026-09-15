import PageContainer from '@/components/layout/page-container'
import { CajasPorPalletListingClient } from '@/features/cajas-por-pallet/components/cajas-por-pallet-listing-client'
import { CajasPorPalletFormSheetTrigger } from '@/features/cajas-por-pallet/components/cajas-por-pallet-form-sheet'

export const metadata = {
  title: 'FAS — Cajas por Pallet'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Cajas por Pallet'
      pageDescription='Cajas teóricas por embalaje y tipo de pallet (precarga la cantidad en OC, Instructivo y Nota de Venta).'
      pageHeaderAction={<CajasPorPalletFormSheetTrigger />}
    >
      <CajasPorPalletListingClient />
    </PageContainer>
  )
}
