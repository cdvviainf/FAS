import type { GrupoMercado } from '../api/types';

const MOCK_GRUPOS: GrupoMercado[] = [
  { id: 1, codigo: 'SUDAMERICA',   descripcion: 'Sudamérica',    descripcionExtranjera: 'South America', creadoEn: '2026-01-10T08:00:00Z' },
  { id: 2, codigo: 'NORTEAMERICA', descripcion: 'Norteamérica',  descripcionExtranjera: 'North America', creadoEn: '2026-01-10T08:01:00Z' },
  { id: 3, codigo: 'EUROPA',       descripcion: 'Europa',         descripcionExtranjera: 'Europe',        creadoEn: '2026-01-10T08:02:00Z' },
  { id: 4, codigo: 'ASIA',         descripcion: 'Asia',           descripcionExtranjera: 'Asia',          creadoEn: '2026-01-10T08:03:00Z' },
  { id: 5, codigo: 'OCEANIA',      descripcion: 'Oceanía',        descripcionExtranjera: 'Oceania',       creadoEn: '2026-01-10T08:04:00Z' }
];

let store: GrupoMercado[] = [...MOCK_GRUPOS];
let nextId = store.length + 1;

export const fakeGruposMercado = {
  getGrupos(filters: { page?: number; limit?: number; q?: string }) {
    let result = [...store];
    if (filters.q) {
      const q = filters.q.toLowerCase();
      result = result.filter(
        (g) => g.descripcion.toLowerCase().includes(q) || g.codigo.toLowerCase().includes(q)
      );
    }
    const total = result.length;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 100;
    const grupos = result.slice((page - 1) * limit, page * limit);
    return { grupos, total };
  },

  createGrupo(data: Omit<GrupoMercado, 'id' | 'creadoEn'>) {
    const grupo: GrupoMercado = { ...data, id: nextId++, creadoEn: new Date().toISOString() };
    store.push(grupo);
    return grupo;
  },

  updateGrupo(id: number, data: Partial<GrupoMercado>) {
    store = store.map((g) => (g.id === id ? { ...g, ...data } : g));
    return store.find((g) => g.id === id);
  },

  deleteGrupo(id: number) {
    store = store.filter((g) => g.id !== id);
  }
};
