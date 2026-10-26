import { api } from '@/lib/api'
import type { ResultadoCarga } from './types'

// Rutas bajo /api/materiales (materiales.routes.ts registra cargaRecetasRoutes
// sin prefijo propio) → segmento "materiales/" explícito.

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

export const cargaRecetasService = {
  // Descarga el Excel base (una hoja Recetas, una fila por componente).
  async descargarTemplate(): Promise<void> {
    const blob = await api.get('materiales/carga-recetas/template').blob()
    descargarBlob(blob, 'Carga_Recetas_base.xlsx')
  },

  // Valida (dryRun, nivel LECTURA) o carga (commit, nivel TOTAL) el archivo.
  // Endpoints separados por permiso: así "Validar" funciona con solo LECTURA.
  async procesar(archivo: File, commit: boolean): Promise<ResultadoCarga> {
    const form = new FormData()
    form.append('archivo', archivo)
    const ruta = commit ? 'materiales/carga-recetas' : 'materiales/carga-recetas/validar'
    const res = await api.post(ruta, { body: form, timeout: 120_000 }).json<{ data: ResultadoCarga }>()
    return res.data
  },

  // Descarga el Excel de reporte de errores del archivo subido.
  async descargarReporte(archivo: File): Promise<void> {
    const form = new FormData()
    form.append('archivo', archivo)
    const blob = await api.post('materiales/carga-recetas/reporte', { body: form, timeout: 120_000 }).blob()
    descargarBlob(blob, 'Reporte_Errores_Carga_Recetas.xlsx')
  },
}
