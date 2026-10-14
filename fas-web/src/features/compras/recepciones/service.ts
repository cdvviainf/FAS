import { api } from '@/lib/api'
import type {
  RecepcionListResponse,
  RecepcionDetalle,
  RecepcionCreateInput,
  RecepcionUpdateInput,
  RecepcionAdjunto,
  OrigenRecepcion,
  EstadoRecepcion,
} from './types'

export const recepcionesService = {
  async list(params: { page?: number; limit?: number; plantaId?: number; origen?: OrigenRecepcion; estado?: EstadoRecepcion } = {}): Promise<RecepcionListResponse> {
    const sp: Record<string, string> = {}
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    if (params.plantaId) sp.plantaId = String(params.plantaId)
    if (params.origen) sp.origen = params.origen
    if (params.estado) sp.estado = params.estado
    return api.get('compras/recepciones', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: RecepcionDetalle }> {
    return api.get(`compras/recepciones/${id}`).json()
  },

  async create(data: RecepcionCreateInput): Promise<{ data: RecepcionDetalle }> {
    return api.post('compras/recepciones', { json: data }).json()
  },

  async update(id: number, data: RecepcionUpdateInput): Promise<{ data: RecepcionDetalle }> {
    return api.patch(`compras/recepciones/${id}`, { json: data }).json()
  },

  async remove(id: number): Promise<void> {
    await api.delete(`compras/recepciones/${id}`)
  },

  async subirAdjunto(id: number, archivo: File): Promise<{ data: RecepcionAdjunto }> {
    const formData = new FormData()
    formData.append('file', archivo)
    return api.post(`compras/recepciones/${id}/adjuntos`, { body: formData }).json()
  },

  async eliminarAdjunto(id: number, adjuntoId: number): Promise<void> {
    await api.delete(`compras/recepciones/${id}/adjuntos/${adjuntoId}`)
  },

  // Confirma la carga de un adjunto ya guardado aceptando las advertencias
  // de características contra el Instructivo de Embalaje (modo PROCESO,
  // 2026-09-02) — sin volver a subir el archivo.
  async confirmarAdvertencias(id: number, adjuntoId: number): Promise<{ data: RecepcionDetalle }> {
    return api.post(`compras/recepciones/${id}/adjuntos/${adjuntoId}/confirmar`).json()
  },

  urlDescargaAdjunto(id: number, adjuntoId: number): string {
    return `/api/compras/recepciones/${id}/adjuntos/${adjuntoId}/descarga`
  },

  // Descarga el formato base guiado por la OC: el Excel del template con los
  // campos de la OC precargados (valores únicos) y validados por dropdown
  // (multivalor), con `filas` filas pre-generadas.
  async descargarFormatoBaseOc(
    templateCargaId: number,
    ordenCompraId: number,
    filas: number,
    nombreArchivo: string,
  ): Promise<void> {
    const blob = await api
      .get('compras/recepciones/formato-base-oc', {
        searchParams: {
          templateCargaId: String(templateCargaId),
          ordenCompraId: String(ordenCompraId),
          filas: String(filas),
        },
      })
      .blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  },
}
