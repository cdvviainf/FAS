import PageContainer from '@/components/layout/page-container'
import { UsuarioForm } from '@/features/usuarios/components/usuario-form'

export const metadata = {
  title: 'FAS — Nuevo Usuario'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nuevo Usuario'
      pageDescription='Crea un nuevo usuario y asígnale un perfil de acceso.'
    >
      <div className='max-w-3xl'>
        <UsuarioForm />
      </div>
    </PageContainer>
  )
}
