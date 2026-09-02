import PageContainer from '@/components/layout/page-container'
import { GestionPalletsClient } from '@/features/operaciones/gestion-pallets/components/gestion-pallets-client'

export const metadata = {
  title: 'FAS — Gestión de Pallets'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Gestión de Pallets'
      pageDescription='Asigna Nota de Calidad, Nota de Condición y marca un pallet como Completo/Incompleto. Solo los pallets Completos son elegibles para Embarque.'
    >
      <GestionPalletsClient />
    </PageContainer>
  )
}
