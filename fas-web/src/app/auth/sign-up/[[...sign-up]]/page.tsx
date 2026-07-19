import { Metadata } from 'next';
import SignUpViewPage from '@/features/auth/components/sign-up-view';

export const metadata: Metadata = {
  title: 'Registro — Frutera Agrosan',
  description: 'Registro de usuario.'
};

export default async function Page() {
  return <SignUpViewPage />;
}
