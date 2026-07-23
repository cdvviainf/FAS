'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Icons } from '@/components/icons'
import { authClient } from '@/lib/auth-client'
import { PasswordStrengthIndicator } from '@/features/usuarios/components/password-strength-indicator'

export function CambiarPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      setError(null)
      if (!currentPassword) throw new Error('Ingresa tu contraseña actual')
      if (newPassword !== newPasswordConfirm) throw new Error('Las contraseñas nuevas no coinciden')

      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      })
      if (error) throw new Error(error.message ?? 'No se pudo cambiar la contraseña')
    },
    onSuccess: () => {
      toast.success('Contraseña actualizada correctamente')
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirm('')
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <Card className='max-w-lg'>
      <CardHeader>
        <CardTitle className='text-base'>Cambiar contraseña</CardTitle>
        <CardDescription>Debes conocer tu contraseña actual para establecer una nueva.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='currentPassword'>Contraseña actual</Label>
            <Input
              id='currentPassword'
              type='password'
              autoComplete='current-password'
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder='••••••••'
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='newPassword'>Contraseña nueva</Label>
            <Input
              id='newPassword'
              type='password'
              autoComplete='new-password'
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder='••••••••'
            />
            <PasswordStrengthIndicator password={newPassword} />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='newPasswordConfirm'>Confirmar contraseña nueva</Label>
            <Input
              id='newPasswordConfirm'
              type='password'
              autoComplete='new-password'
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              placeholder='••••••••'
            />
          </div>

          <div className='flex items-center gap-2'>
            <Checkbox
              id='revokeOtherSessions'
              checked={revokeOtherSessions}
              onCheckedChange={(v) => setRevokeOtherSessions(v === true)}
            />
            <Label htmlFor='revokeOtherSessions' className='font-normal'>
              Cerrar sesión en otros dispositivos
            </Label>
          </div>

          {error && <p className='text-sm text-destructive'>{error}</p>}

          <Button type='submit' isLoading={mutation.isPending}>
            <Icons.check className='mr-2 h-4 w-4' />
            Actualizar contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
