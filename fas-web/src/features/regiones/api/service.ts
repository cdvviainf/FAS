import { fakeRegiones } from '../constants/mock-regiones';
import type { RegionFilters, RegionMutationPayload, RegionesResponse } from './types';

export async function getRegiones(filters: RegionFilters): Promise<RegionesResponse> {
  await new Promise((r) => setTimeout(r, 150));
  return fakeRegiones.getRegiones(filters);
}

export async function createRegion(data: RegionMutationPayload) {
  await new Promise((r) => setTimeout(r, 200));
  return fakeRegiones.createRegion(data);
}

export async function updateRegion(id: number, data: RegionMutationPayload) {
  await new Promise((r) => setTimeout(r, 200));
  return fakeRegiones.updateRegion(id, data);
}

export async function deleteRegion(id: number) {
  await new Promise((r) => setTimeout(r, 200));
  return fakeRegiones.deleteRegion(id);
}
