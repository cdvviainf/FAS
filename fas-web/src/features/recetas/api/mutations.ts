import { createReceta, updateReceta, deleteReceta } from './service';
import type { RecetaMutationPayload } from './types';

export const createRecetaMutation = {
  mutationFn: (payload: RecetaMutationPayload) => createReceta(payload)
};

export const updateRecetaMutation = {
  mutationFn: ({ id, values }: { id: number; values: RecetaMutationPayload }) =>
    updateReceta(id, values)
};

export const deleteRecetaMutation = {
  mutationFn: (id: number) => deleteReceta(id)
};
