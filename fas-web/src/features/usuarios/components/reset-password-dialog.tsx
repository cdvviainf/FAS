'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usuariosService } from '../service'
import type { Usuario } from '../types'
import { PasswordStrengthIndicator } from './password-strength-indicator'

interface ResetPasswordDialogProps {
  usuario: Usuario
  open: boolean
  onClose: () => void
}

/** Valida la complejidad en cliente — refleja la política del backend (UP6). */
function validarComplejidad(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  if (!/[A-Z]/.test(password)) return 'Debe contener al menos una letra mayúscula'
  if (!/[a-z]/.test(password)) return 'Debe contener al menos una letra minúscula'
  if (!/[0-9]/.test(password)) return 'Debe contener al menos un número'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Debe contener al menos un símbolo (ej: !@#$%)'
  return null
}

export function ResetPasswordDialog({ usuario, open, onClose }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const resetState = () => {
    setPassword('')
    setPasswordConfirm('')
    setError(null)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const mutation = useMutation({
    mutationFn: () => usuariosService.changePassword(usuario.id, { password, passwordConfirm }),
    onSuccess: () => {
      toast.success('Contraseña restablecida')
      handleClose()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al restablecer la contraseña'),
  })

  const handleSubmit = () => {
    const complejidad = validarComplejidad(password)
    if (complejidad) {
      setError(complejidad)
      return
    }
    if (password !== passwordConfirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
          <DialogDescription>
            Define una nueva contraseña para <span className='font-medium'>{usuario.nombre}</span>{' '}
            (<span className='font-mono'>{usuario.email}</span>). El usuario podrá ingresar de inmediato con la nueva clave.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='space-y-2'>
            <Label htmlFor='reset-password'>Nueva contraseña</Label>
            <Input
              id='reset-password'
              type='password'
              autoComplete='new-password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordStrengthIndicator password={password} />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='reset-password-confirm'>Confirmar contraseña</Label>
            <Input
              id='reset-password-confirm'
              type='password'
              autoComplete='new-password'
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </div>

          {error && <p className='text-sm text-destructive'>{error}</p>}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={handleClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : 'Restablecer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
