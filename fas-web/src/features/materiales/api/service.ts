import { fakeArticulos } from '../constants/mock-articulos';
import type { ArticuloFilters, ArticuloMutationPayload, ArticulosResponse } from './types';

export async function getArticulos(filters: ArticuloFilters): Promise<ArticulosResponse> {
  await new Promise((r) => setTimeout(r, 150));
  return fakeArticulos.getArticulos(filters);
}

export async function createArticulo(data: ArticuloMutationPayload) {
  await new Promise((r) => setTimeout(r, 200));
  const controlaStock = data.tipoCosteo === 'PROMEDIO_PONDERADO';
  return fakeArticulos.createArticulo({ ...data, controlaStock });
}

export async function updateArticulo(id: number, data: ArticuloMutationPayload) {
  await new Promise((r) => setTimeout(r, 200));
  const controlaStock = data.tipoCosteo === 'PROMEDIO_PONDERADO';
  return fakeArticulos.updateArticulo(id, { ...data, controlaStock });
}

export async function deleteArticulo(id: number) {
  await new Promise((r) => setTimeout(r, 200));
  return fakeArticulos.deleteArticulo(id);
}
