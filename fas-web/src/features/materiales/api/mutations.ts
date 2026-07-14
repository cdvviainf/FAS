import { createArticulo, updateArticulo, deleteArticulo } from './service';
import type { ArticuloMutationPayload } from './types';

export const createArticuloMutation = {
  mutationFn: (data: ArticuloMutationPayload) => createArticulo(data)
};

export const updateArticuloMutation = {
  mutationFn: ({ id, values }: { id: number; values: ArticuloMutationPayload }) =>
    updateArticulo(id, values)
};

export const deleteArticuloMutation = {
  mutationFn: (id: number) => deleteArticulo(id)
};
