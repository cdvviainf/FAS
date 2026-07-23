'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { correoConfigService, type CorreoConfigInput } from '../service'

const ITEM = 'config.general'

// Defaults Office365
const DEFAULTS: CorreoConfigInput = {
  host: 'smtp.office365.com',
  puerto: 587,
  seguridad: 'STARTTLS',
  usuario: '',
  password: '',
  remitenteNombre: 'Frutera Agrosan',
  remitenteEmail: '',
}

export function SmtpConfigForm() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [form, setForm] = useState<CorreoConfigInput>(DEFAULTS)
  const [tienePassword, setTienePassword] = useState(false)
  const [destinatarioPrueba, setDestinatarioPrueba] = useState('')

  const { data, isPending } = useQuery({
    queryKey: ['config-correo'],
    queryFn: () => correoConfigService.get(),
  })

  useEffect(() => {
    if (data?.data) {
      const c = data.data
      setForm({
        host: c.host,
        puerto: c.puerto,
        seguridad: c.seguridad,
        usuario: c.usuario,
        password: '', // nunca viene del backend
        remitenteNombre: c.remitenteNombre,
        remitenteEmail: c.remitenteEmail,
      })
      setTienePassword(c.tienePassword)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => {
      // Si hay password guardada y el campo va vacío, no lo enviamos (se conserva)
      const payload: CorreoConfigInput = { ...form }
      if (tienePassword && !form.password) delete payload.password
      return correoConfigService.save(payload)
    },
    onSuccess: () => {
      toast.success('Configuración SMTP guardada')
      setTienePassword(true)
      setForm((f) => ({ ...f, password: '' }))
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar la configuración'),
  })

  const probarMutation = useMutation({
    mutationFn: () => correoConfigService.probar(destinatarioPrueba),
    onSuccess: () => toast.success('Correo de prueba enviado. Revisa la bandeja de entrada.'),
    onError: (e: Error) => toast.error(e.message || 'Error al enviar el correo de prueba'),
  })

  function set<K extends keyof CorreoConfigInput>(key: K, value: CorreoConfigInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  if (isPending) return <p className='text-sm text-muted-foreground'>Cargando configuración...</p>

  const disabled = !puedeEscribir

  return (
    <div className='max-w-2xl space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>Servidor de correo (SMTP)</CardTitle>
          <CardDescription>
            Casilla de correo que el sistema usa para enviar notificaciones (Office365).
            Requiere tener habilitado <strong>SMTP AUTH</strong> en el tenant de Microsoft 365.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1.5'>
              <Label>Servidor (host)</Label>
              <Input value={form.host} onChange={(e) => set('host', e.target.value)} disabled={disabled} placeholder='smtp.office365.com' />
            </div>
            <div className='space-y-1.5'>
              <Label>Puerto</Label>
              <Input type='number' value={form.puerto} onChange={(e) => set('puerto', parseInt(e.target.value) || 0)} disabled={disabled} />
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label>Seguridad</Label>
            <Select value={form.seguridad} onValueChange={(v) => set('seguridad', v as CorreoConfigInput['seguridad'])} disabled={disabled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='STARTTLS'>STARTTLS (recomendado, puerto 587)</SelectItem>
                <SelectItem value='SSL'>SSL/TLS (puerto 465)</SelectItem>
                <SelectItem value='NINGUNA'>Ninguna</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label>Usuario (casilla)</Label>
            <Input value={form.usuario} onChange={(e) => set('usuario', e.target.value)} disabled={disabled} placeholder='notificaciones@agrosan.cl' />
          </div>

          <div className='space-y-1.5'>
            <Label>Contraseña</Label>
            <Input
              type='password'
              value={form.password ?? ''}
              onChange={(e) => set('password', e.target.value)}
              disabled={disabled}
              placeholder={tienePassword ? '•••••••• (dejar vacío para conservar)' : 'Contraseña de la casilla'}
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1.5'>
              <Label>Nombre remitente</Label>
              <Input value={form.remitenteNombre} onChange={(e) => set('remitenteNombre', e.target.value)} disabled={disabled} />
            </div>
            <div className='space-y-1.5'>
              <Label>Email remitente</Label>
              <Input value={form.remitenteEmail} onChange={(e) => set('remitenteEmail', e.target.value)} disabled={disabled} placeholder='notificaciones@agrosan.cl' />
            </div>
          </div>

          {puedeEscribir && (
            <div className='flex justify-end'>
              <Button onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending}>
                Guardar configuración
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {puedeEscribir && tienePassword && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Probar envío</CardTitle>
            <CardDescription>Envía un correo de prueba para validar la configuración.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex items-end gap-2'>
              <div className='flex-1 space-y-1.5'>
                <Label>Destinatario</Label>
                <Input
                  type='email'
                  value={destinatarioPrueba}
                  onChange={(e) => setDestinatarioPrueba(e.target.value)}
                  placeholder='tu@correo.cl'
                />
              </div>
              <Button
                variant='outline'
                onClick={() => probarMutation.mutate()}
                isLoading={probarMutation.isPending}
                disabled={!destinatarioPrueba}
              >
                <Icons.send className='mr-1 h-4 w-4' /> Enviar prueba
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
