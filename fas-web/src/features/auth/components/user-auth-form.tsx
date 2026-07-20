'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function UserAuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? 'Credenciales incorrectas.');
        return;
      }
      toast.success('Sesión iniciada');
      router.push('/dashboard/overview');
      router.refresh();
    } catch {
      setError('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className='w-full space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='email'>Correo electrónico</Label>
        <Input
          id='email'
          type='email'
          placeholder='usuario@agrosan.cl'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
          autoComplete='email'
        />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='password'>Contraseña</Label>
        <Input
          id='password'
          type='password'
          placeholder='••••••••'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
          autoComplete='current-password'
        />
      </div>
      {error && <p className='text-destructive text-sm'>{error}</p>}
      <Button type='submit' className='w-full' disabled={loading}>
        {loading ? 'Ingresando...' : 'Iniciar sesión'}
      </Button>
    </form>
  );
}
