import { api } from '@/lib/api'

export interface CorreoConfig {
  id: number
  host: string
  puerto: number
  seguridad: 'STARTTLS' | 'SSL' | 'NINGUNA'
  usuario: string
  remitenteNombre: string
  remitenteEmail: string
  tienePassword: boolean
}

export interface CorreoConfigInput {
  host: string
  puerto: number
  seguridad: 'STARTTLS' | 'SSL' | 'NINGUNA'
  usuario: string
  password?: string
  remitenteNombre: string
  remitenteEmail: string
}

export const correoConfigService = {
  async get(): Promise<{ data: CorreoConfig | null }> {
    return api.get('config/correo').json()
  },
  async save(data: CorreoConfigInput): Promise<{ data: CorreoConfig }> {
    return api.put('config/correo', { json: data }).json()
  },
  async probar(destinatario: string): Promise<void> {
    await api.post('config/correo/probar', { json: { destinatario } })
  },
}
