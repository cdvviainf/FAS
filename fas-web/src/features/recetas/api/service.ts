import { fakeRecetas } from '../constants/mock-recetas';
import type { RecetaFilters, RecetaMutationPayload } from './types';
import { MOCK_ARTICULOS } from '@/features/materiales/constants/mock-articulos';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Public helpers for select options in the form
export const EMBALAJE_OPTIONS = MOCK_ARTICULOS.filter((a) => a.tipo === 'EMBALAJE' && a.activo).map(
  (a) => ({ value: String(a.id), label: `${a.codigo} — ${a.descripcion}` })
);

export const COMPONENTE_OPTIONS = MOCK_ARTICULOS.filter(
  (a) => (a.tipo === 'MATERIAL_EMBALAJE' || a.tipo === 'SERVICIO') && a.activo
).map((a) => ({
  value: String(a.id),
  label: `${a.codigo} — ${a.descripcion}`,
  unidad: a.unidad
}));

export async function fetchRecetas(filters: RecetaFilters) {
  await delay(150 + Math.random() * 50);
  return fakeRecetas.getRecetas(filters);
}

export async function createReceta(payload: RecetaMutationPayload) {
  await delay(200);
  const embalaje = MOCK_ARTICULOS.find((a) => a.id === payload.embalajeId);
  return fakeRecetas.createReceta({
    ...payload,
    embalajeCodigo: embalaje?.codigo ?? '',
    embalajeDescripcion: embalaje?.descripcion ?? '',
    detalle: payload.detalle.map((d) => {
      const comp = MOCK_ARTICULOS.find((a) => a.id === d.componenteId);
      return {
        id: 0,
        componenteId: d.componenteId,
        componenteCodigo: comp?.codigo ?? '',
        componenteDescripcion: comp?.descripcion ?? '',
        componenteUnidad: comp?.unidad ?? 'UN',
        cantidadAConsumir: d.cantidadAConsumir
      };
    })
  });
}

export async function updateReceta(id: number, payload: RecetaMutationPayload) {
  await delay(200);
  const embalaje = MOCK_ARTICULOS.find((a) => a.id === payload.embalajeId);
  return fakeRecetas.updateReceta(id, {
    ...payload,
    embalajeCodigo: embalaje?.codigo ?? '',
    embalajeDescripcion: embalaje?.descripcion ?? '',
    detalle: payload.detalle.map((d) => {
      const comp = MOCK_ARTICULOS.find((a) => a.id === d.componenteId);
      return {
        id: 0,
        componenteId: d.componenteId,
        componenteCodigo: comp?.codigo ?? '',
        componenteDescripcion: comp?.descripcion ?? '',
        componenteUnidad: comp?.unidad ?? 'UN',
        cantidadAConsumir: d.cantidadAConsumir
      };
    })
  });
}

export async function deleteReceta(id: number) {
  await delay(150);
  fakeRecetas.deleteReceta(id);
}
