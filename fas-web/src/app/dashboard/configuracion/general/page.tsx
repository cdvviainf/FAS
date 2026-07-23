import PageContainer from '@/components/layout/page-container'
import { SmtpConfigForm } from '@/features/configuracion-general/components/smtp-config-form'

export const metadata = {
  title: 'FAS — Configuración General'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Configuración General'
      pageDescription='Parámetros globales del sistema, incluida la casilla de correo para notificaciones.'
    >
      <SmtpConfigForm />
    </PageContainer>
  )
}
