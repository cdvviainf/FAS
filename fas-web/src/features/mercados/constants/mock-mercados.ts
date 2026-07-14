// This mock file is kept for historical reference only.
// The real API is used in production via features/mercados/api/service.ts.
// It is no longer imported by any active code.
export const fakeMercados = {
  getMercados: () => ({ mercados: [], total: 0 }),
  createMercado: () => ({}),
  updateMercado: () => ({}),
  deleteMercado: () => ({})
};
