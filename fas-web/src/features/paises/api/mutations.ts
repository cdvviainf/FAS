import { createPais, updatePais, deletePais } from './service';
import type { PaisMutationPayload } from './types';

export const createPaisMutation = {
  mutationFn: (data: PaisMutationPayload) => createPais(data)
};

export const updatePaisMutation = {
  mutationFn: ({ id, values }: { id: number; values: PaisMutationPayload }) =>
    updatePais(id, values)
};

export const deletePaisMutation = {
  mutationFn: (id: number) => deletePais(id)
};
