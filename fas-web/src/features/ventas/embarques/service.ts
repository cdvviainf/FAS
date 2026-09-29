import { api } from '@/lib/api'
import type {
  DatosInstructivoInput,
  DatosReservaManualInput,
  Embarque,
  EmbarqueCreateInput,
  EmbarqueDetalle,
  EmbarqueListResponse,
  InstructivoHijo,
  InstructivoHijoUpdateInput,
  PackingListEmbarque,
  PalletResumen,
} from './types'

export const embarquesService = {
  async list(params: { notaVentaId?: number; page?: number; limit?: number } = {}): Promise<EmbarqueListResponse> {
    const sp: Record<string, string> = {}
    if (params.notaVentaId) sp.notaVentaId = String(params.notaVentaId)
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    return api.get('ventas/embarques', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: EmbarqueDetalle }> {
    return api.get(`ventas/embarques/${id}`).json()
  },

  async create(data: EmbarqueCreateInput): Promise<{ data: Embarque }> {
    return api.post('ventas/embarques', { json: data }).json()
  },

  // Generación múltiple: una reserva/Embarque por contenedor (2026-09-28).
  async estimacionContenedores(notaVentaId: number): Promise<{ data: { totalPallets: number; contenedoresSugeridos: number; palletsPorContenedor: number } }> {
    return api.get('ventas/embarques/estimacion-contenedores', { searchParams: { notaVentaId: String(notaVentaId) } }).json()
  },

  async createMultiples(data: EmbarqueCreateInput & { cantidad: number }): Promise<{ data: { embarques: Embarque[]; creados: number; aglFallo: boolean } }> {
    return api.post('ventas/embarques/multiples', { json: data }).json()
  },

  // ─── Seleccionar Pallets ──────────────────────────────────────────────────

  async listarPalletsDisponibles(id: number): Promise<{ data: PalletResumen[] }> {
    return api.get(`ventas/embarques/${id}/pallets-disponibles`).json()
  },

  async agregarPallets(id: number, palletIds: number[]): Promise<{ data: EmbarqueDetalle }> {
    return api.post(`ventas/embarques/${id}/pallets`, { json: { palletIds } }).json()
  },

  async quitarPallet(id: number, palletId: number): Promise<{ data: EmbarqueDetalle }> {
    return api.delete(`ventas/embarques/${id}/pallets/${palletId}`).json()
  },

  // ─── Despachar ────────────────────────────────────────────────────────────

  async despachar(id: number): Promise<{ data: EmbarqueDetalle }> {
    return api.patch(`ventas/embarques/${id}/despachar`).json()
  },

  async anularDespacho(id: number): Promise<{ data: EmbarqueDetalle }> {
    return api.patch(`ventas/embarques/${id}/anular-despacho`).json()
  },

  // ─── Packing List (compras.md §9.3, cierra EP-QA-003) ────────────────────

  async subirPackingList(id: number, templateCargaId: number, archivo: File): Promise<{ data: PackingListEmbarque }> {
    const formData = new FormData()
    formData.append('file', archivo)
    return api
      .post(`ventas/embarques/${id}/packing-list`, { body: formData, searchParams: { templateCargaId: String(templateCargaId) } })
      .json()
  },

  urlDescargaPackingList(id: number, packingListId?: number): string {
    const base = `/api/ventas/embarques/${id}/packing-list/descarga`
    return packingListId ? `${base}?packingListId=${packingListId}` : base
  },

  // Packing parcializado (2026-09-28): eliminar un archivo de la carga.
  async eliminarPackingList(id: number, packingListId: number): Promise<{ data: EmbarqueDetalle }> {
    return api.delete(`ventas/embarques/${id}/packing-list/${packingListId}`).json()
  },

  // ─── Solicitud de Reserva (ventas.md §4.3) ────────────────────────────────

  async solicitarReserva(id: number): Promise<{ data: EmbarqueDetalle }> {
    return api.post(`ventas/embarques/${id}/solicitud-reserva`).json()
  },

  async dejarReservaManual(id: number): Promise<{ data: EmbarqueDetalle }> {
    return api.post(`ventas/embarques/${id}/reserva-manual`).json()
  },

  async guardarDatosReservaManual(id: number, data: DatosReservaManualInput): Promise<{ data: EmbarqueDetalle }> {
    return api.patch(`ventas/embarques/${id}/datos-reserva`, { json: data }).json()
  },

  // Información base de la reserva (2026-09-28): fecha compromiso, temperatura,
  // CBM, tipo de BL.
  async guardarDatosReservaBase(
    id: number,
    data: { fechaCompromiso?: string | null; temperatura?: number | null; cbm?: number | null; tipoBlId?: number | null },
  ): Promise<{ data: EmbarqueDetalle }> {
    return api.patch(`ventas/embarques/${id}/datos-reserva-base`, { json: data }).json()
  },

  // ─── Instructivo de Embarque (2026-09-21, ventas.md R11) ──────────────────

  async guardarDatosInstructivo(id: number, data: DatosInstructivoInput): Promise<{ data: EmbarqueDetalle }> {
    return api.patch(`ventas/embarques/${id}/datos-instructivo`, { json: data }).json()
  },

  async listarInstructivosHijos(id: number): Promise<{ data: InstructivoHijo[] }> {
    return api.get(`ventas/embarques/${id}/instructivos`).json()
  },

  async generarInstructivosHijos(id: number): Promise<{ data: InstructivoHijo[] }> {
    return api.post(`ventas/embarques/${id}/instructivos/generar`).json()
  },

  async actualizarInstructivoHijo(id: number, instructivoId: number, data: InstructivoHijoUpdateInput): Promise<{ data: InstructivoHijo }> {
    return api.patch(`ventas/embarques/${id}/instructivos/${instructivoId}`, { json: data }).json()
  },
}
