import type { Pais } from '../api/types';

const MOCK_PAISES: Pais[] = [
  { id: 1,  codigo: 'CHL', descripcion: 'Chile',          descripcionExtranjera: 'Chile',          esPaisOrigen: true,  creadoEn: '2026-01-10T08:00:00Z' },
  { id: 2,  codigo: 'USA', descripcion: 'Estados Unidos', descripcionExtranjera: 'United States',  esPaisOrigen: false, creadoEn: '2026-01-10T08:01:00Z' },
  { id: 3,  codigo: 'CHN', descripcion: 'China',          descripcionExtranjera: 'China',          esPaisOrigen: false, creadoEn: '2026-01-10T08:02:00Z' },
  { id: 4,  codigo: 'NLD', descripcion: 'Países Bajos',  descripcionExtranjera: 'Netherlands',    esPaisOrigen: false, creadoEn: '2026-01-10T08:03:00Z' },
  { id: 5,  codigo: 'GBR', descripcion: 'Reino Unido',   descripcionExtranjera: 'United Kingdom', esPaisOrigen: false, creadoEn: '2026-01-10T08:04:00Z' },
  { id: 6,  codigo: 'JPN', descripcion: 'Japón',         descripcionExtranjera: 'Japan',          esPaisOrigen: false, creadoEn: '2026-01-10T08:05:00Z' },
  { id: 7,  codigo: 'DEU', descripcion: 'Alemania',      descripcionExtranjera: 'Germany',        esPaisOrigen: false, creadoEn: '2026-01-10T08:06:00Z' },
  { id: 8,  codigo: 'MEX', descripcion: 'México',        descripcionExtranjera: 'Mexico',         esPaisOrigen: false, creadoEn: '2026-01-10T08:07:00Z' },
  { id: 9,  codigo: 'BRA', descripcion: 'Brasil',        descripcionExtranjera: 'Brazil',         esPaisOrigen: false, creadoEn: '2026-01-10T08:08:00Z' },
  { id: 10, codigo: 'KOR', descripcion: 'Corea del Sur', descripcionExtranjera: 'South Korea',    esPaisOrigen: false, creadoEn: '2026-01-10T08:09:00Z' },
  { id: 11, codigo: 'ESP', descripcion: 'España',        descripcionExtranjera: 'Spain',          esPaisOrigen: false, creadoEn: '2026-01-10T08:10:00Z' },
  { id: 12, codigo: 'ARG', descripcion: 'Argentina',     descripcionExtranjera: 'Argentina',      esPaisOrigen: false, creadoEn: '2026-01-10T08:11:00Z' },
  { id: 13, codigo: 'COL', descripcion: 'Colombia',      descripcionExtranjera: 'Colombia',       esPaisOrigen: false, creadoEn: '2026-01-10T08:12:00Z' },
  { id: 14, codigo: 'CAN', descripcion: 'Canadá',        descripcionExtranjera: 'Canada',         esPaisOrigen: false, creadoEn: '2026-01-10T08:13:00Z' },
  { id: 15, codigo: 'HKG', descripcion: 'Hong Kong',     descripcionExtranjera: 'Hong Kong',      esPaisOrigen: false, creadoEn: '2026-01-10T08:14:00Z' }
];

let store: Pais[] = [...MOCK_PAISES];
let nextId = store.length + 1;

export const fakePaises = {
  getPaises(filters: { page?: number; limit?: number; q?: string }) {
    let result = [...store];
    if (filters.q) {
      const q = filters.q.toLowerCase();
      result = result.filter(
        (p) => p.descripcion.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
      );
    }
    const total = result.length;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 100;
    const paises = result.slice((page - 1) * limit, page * limit);
    return { paises, total };
  },

  createPais(data: Omit<Pais, 'id' | 'creadoEn'>) {
    const pais: Pais = { ...data, id: nextId++, creadoEn: new Date().toISOString() };
    store.push(pais);
    return pais;
  },

  updatePais(id: number, data: Partial<Pais>) {
    store = store.map((p) => (p.id === id ? { ...p, ...data } : p));
    return store.find((p) => p.id === id);
  },

  deletePais(id: number) {
    store = store.filter((p) => p.id !== id);
  }
};
