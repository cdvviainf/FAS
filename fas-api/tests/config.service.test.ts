import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/modules/config/config.repository.js', () => ({
  countActiveReferences: vi.fn(),
  countChildren: vi.fn(),
  countTemporadaPredeterminada: vi.fn(),
  createMantenedor: vi.fn(),
  clearTemporadaPredeterminada: vi.fn(),
  findMantenedorByCodigo: vi.fn(),
  findTemporadaOverlap: vi.fn(),
  getMantenedorById: vi.fn(),
  softDeleteMantenedor: vi.fn(),
}))

import * as repo from '../src/modules/config/config.repository.js'
import {
  actualizarMantenedor,
  crearMantenedor,
  eliminarMantenedor,
} from '../src/modules/config/config.service.js'

const mockedRepo = vi.mocked(repo)

const temporadaBase = {
  codigo: '2026-2027',
  descripcion: 'Temporada 2026-2027',
  fechaInicio: '2026-07-01',
  fechaTermino: '2027-06-30',
  predeterminada: false,
}

describe('reglas de mantenedores', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRepo.findMantenedorByCodigo.mockResolvedValue(null)
    mockedRepo.findTemporadaOverlap.mockResolvedValue(null)
    mockedRepo.countChildren.mockResolvedValue(0)
    mockedRepo.countActiveReferences.mockResolvedValue(0)
    mockedRepo.createMantenedor.mockImplementation(async (_modelo, data) => ({
      id: 1,
      ...data,
    }))
  })

  describe('temporada predeterminada', () => {
    it('fuerza como predeterminada la primera temporada', async () => {
      mockedRepo.countTemporadaPredeterminada.mockResolvedValue(0)

      await crearMantenedor('temporada', { ...temporadaBase })

      expect(mockedRepo.createMantenedor).toHaveBeenCalledWith(
        'temporada',
        expect.objectContaining({ predeterminada: true }),
        'sistema',
      )
    })

    it('mantiene la elección del usuario cuando ya existe una predeterminada', async () => {
      mockedRepo.countTemporadaPredeterminada.mockResolvedValue(1)

      await crearMantenedor('temporada', { ...temporadaBase })

      expect(mockedRepo.createMantenedor).toHaveBeenCalledWith(
        'temporada',
        expect.objectContaining({ predeterminada: false }),
        'sistema',
      )
      expect(mockedRepo.clearTemporadaPredeterminada).not.toHaveBeenCalled()
    })

    it('impide desmarcar la única temporada predeterminada', async () => {
      mockedRepo.getMantenedorById.mockResolvedValue({
        id: 1,
        ...temporadaBase,
        predeterminada: true,
      })
      mockedRepo.countTemporadaPredeterminada.mockResolvedValue(0)

      await expect(
        actualizarMantenedor('temporada', 1, { predeterminada: false }),
      ).rejects.toMatchObject({ statusCode: 422 })
    })

    it('impide eliminar la temporada predeterminada', async () => {
      mockedRepo.getMantenedorById.mockResolvedValue({
        id: 1,
        ...temporadaBase,
        predeterminada: true,
      })

      await expect(eliminarMantenedor('temporada', 1)).rejects.toMatchObject({
        statusCode: 409,
      })
      expect(mockedRepo.softDeleteMantenedor).not.toHaveBeenCalled()
    })
  })

  describe('soft delete de registros en uso', () => {
    it('impide eliminar una región con provincias vigentes', async () => {
      mockedRepo.getMantenedorById.mockResolvedValue({ id: 1, codigo: 'RM' })
      mockedRepo.countChildren.mockResolvedValueOnce(2)

      await expect(eliminarMantenedor('region', 1)).rejects.toMatchObject({
        statusCode: 409,
      })
      expect(mockedRepo.softDeleteMantenedor).not.toHaveBeenCalled()
    })

    it('impide eliminar una comuna usada por una dirección vigente', async () => {
      mockedRepo.getMantenedorById.mockResolvedValue({ id: 1, codigo: 'STGO' })
      mockedRepo.countChildren.mockResolvedValue(0)
      mockedRepo.countActiveReferences.mockResolvedValueOnce(1)

      await expect(eliminarMantenedor('comuna', 1)).rejects.toMatchObject({
        statusCode: 409,
      })
      expect(mockedRepo.countActiveReferences).toHaveBeenCalledWith(
        'entidadDireccion',
        1,
        'comunaId',
        undefined,
      )
      expect(mockedRepo.softDeleteMantenedor).not.toHaveBeenCalled()
    })

    it('permite eliminar cuando no existen referencias vigentes', async () => {
      mockedRepo.getMantenedorById.mockResolvedValue({ id: 1, codigo: 'STGO' })

      await eliminarMantenedor('comuna', 1, 'usuario-test')

      expect(mockedRepo.softDeleteMantenedor).toHaveBeenCalledWith(
        'comuna',
        1,
        'usuario-test',
      )
    })
  })
})
