import { createGrupoMercado, updateGrupoMercado, deleteGrupoMercado } from './service';
import type { GrupoMercadoMutationPayload } from './types';

export const createGrupoMercadoMutation = {
  mutationFn: (data: GrupoMercadoMutationPayload) => createGrupoMercado(data)
};

export const updateGrupoMercadoMutation = {
  mutationFn: ({ id, values }: { id: number; values: GrupoMercadoMutationPayload }) =>
    updateGrupoMercado(id, values)
};

export const deleteGrupoMercadoMutation = {
  mutationFn: (id: number) => deleteGrupoMercado(id)
};
