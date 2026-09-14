import { api } from '@/lib/api'
import type { ResultadoCarga } from './types'

// Todas las rutas viven bajo /api/config (config.routes.ts registra
// cargaMaestrosRoutes sin prefijo propio) → segmento "config/" explícito.

function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const cargaMaestrosService = {
  // Descarga el Excel base vacío.
  async descargarTemplate(): Promise<void> {
    const blob = await api.get('config/carga-maestros/template').blob()
    descargarBlob(blob, 'Carga_Masiva_Maestros_base.xlsx')
  },

  // Valida (dryRun) o carga (commit) el archivo. Devuelve el resumen + errores.
  async procesar(archivo: File, commit: boolean): Promise<ResultadoCarga> {
    const form = new FormData()
    form.append('archivo', archivo)
    const res = await api
      .post('config/carga-maestros', {
        body: form,
        searchParams: commit ? { commit: 'true' } : {},
        timeout: 120_000,
      })
      .json<{ data: ResultadoCarga }>()
    return res.data
  },

  // Descarga el Excel de reporte de errores del archivo subido.
  async descargarReporte(archivo: File): Promise<void> {
    const form = new FormData()
    form.append('archivo', archivo)
    const blob = await api.post('config/carga-maestros/reporte', { body: form, timeout: 120_000 }).blob()
    descargarBlob(blob, 'Reporte_Errores_Carga_Masiva.xlsx')
  },
}
