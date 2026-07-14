import { createMercado, updateMercado, deleteMercado } from './service';
import type { MercadoMutationPayload } from './types';

export const createMercadoMutation = {
  mutationFn: (data: MercadoMutationPayload) => createMercado(data)
};

export const updateMercadoMutation = {
  mutationFn: ({ id, values }: { id: number; values: MercadoMutationPayload }) =>
    updateMercado(id, values)
};

export const deleteMercadoMutation = {
  mutationFn: (id: number) => deleteMercado(id)
};
