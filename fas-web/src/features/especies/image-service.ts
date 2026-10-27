import { api } from '@/lib/api'

// Imagen de la especie para el banner de los PDF. Binario servido por endpoint
// propio (config/especies/:id/imagen), mismo patrón que el logo de empresa.
export const especieImagenService = {
  async subir(especieId: number, file: File): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)
    await api.post(`config/especies/${especieId}/imagen`, { body: formData })
  },

  async eliminar(especieId: number): Promise<void> {
    await api.delete(`config/especies/${especieId}/imagen`)
  },

  // Descarga vía ky (no <img src> directo): ky adjunta X-Empresa-Id, así el
  // preview resuelve la MISMA empresa activa que subir/eliminar (multiempresa).
  async descargar(especieId: number): Promise<Blob> {
    return api.get(`config/especies/${especieId}/imagen`).blob()
  },
}
