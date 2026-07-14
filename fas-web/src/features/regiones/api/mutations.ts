import { createRegion, updateRegion, deleteRegion } from './service';
import type { RegionMutationPayload } from './types';

export const createRegionMutation = {
  mutationFn: (data: RegionMutationPayload) => createRegion(data)
};

export const updateRegionMutation = {
  mutationFn: ({ id, values }: { id: number; values: RegionMutationPayload }) =>
    updateRegion(id, values)
};

export const deleteRegionMutation = {
  mutationFn: (id: number) => deleteRegion(id)
};
