import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Registro — Frutera Agrosan',
  description: 'Registro de usuario.'
};

export default function SignUpViewPage() {
  return (
    <div className='flex min-h-screen items-center justify-center p-4'>
      <div className='w-full max-w-sm space-y-4 text-center'>
        <h1 className='text-2xl font-semibold tracking-tight'>Registro</h1>
        <div className='bg-muted rounded-lg p-6 text-sm'>
          El registro de usuarios será implementado con Better Auth.
        </div>
        <Link href='/auth/sign-in' className='text-primary text-sm underline underline-offset-4'>
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
