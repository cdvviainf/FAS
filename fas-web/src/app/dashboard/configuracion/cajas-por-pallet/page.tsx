import PageContainer from '@/components/layout/page-container'
import { CajasPorPalletMatriz } from '@/features/cajas-por-pallet/components/cajas-por-pallet-matriz'

export const metadata = {
  title: 'FAS — Cajas por Pallet'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Cajas por Pallet'
      pageDescription='Elige tipo de pallet y especie, e ingresa las cajas teóricas de cada embalaje. Se graba al salir de cada campo.'
    >
      <CajasPorPalletMatriz />
    </PageContainer>
  )
}
