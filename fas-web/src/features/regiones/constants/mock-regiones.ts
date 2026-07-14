import type { Region } from '../api/types';

const MOCK_REGIONES: Region[] = [
  { id: 1,  codigo: 'XV',  descripcion: 'Región de Arica y Parinacota',                    descripcionExtranjera: 'Arica and Parinacota Region',    creadoEn: '2026-01-10T08:00:00Z' },
  { id: 2,  codigo: 'I',   descripcion: 'Región de Tarapacá',                               descripcionExtranjera: 'Tarapacá Region',                  creadoEn: '2026-01-10T08:01:00Z' },
  { id: 3,  codigo: 'II',  descripcion: 'Región de Antofagasta',                            descripcionExtranjera: 'Antofagasta Region',               creadoEn: '2026-01-10T08:02:00Z' },
  { id: 4,  codigo: 'III', descripcion: 'Región de Atacama',                                descripcionExtranjera: 'Atacama Region',                   creadoEn: '2026-01-10T08:03:00Z' },
  { id: 5,  codigo: 'IV',  descripcion: 'Región de Coquimbo',                               descripcionExtranjera: 'Coquimbo Region',                  creadoEn: '2026-01-10T08:04:00Z' },
  { id: 6,  codigo: 'V',   descripcion: 'Región de Valparaíso',                             descripcionExtranjera: 'Valparaíso Region',                creadoEn: '2026-01-10T08:05:00Z' },
  { id: 7,  codigo: 'RM',  descripcion: 'Región Metropolitana de Santiago',                 descripcionExtranjera: 'Metropolitan Region of Santiago',  creadoEn: '2026-01-10T08:06:00Z' },
  { id: 8,  codigo: 'VI',  descripcion: 'Región del Libertador General Bernardo O\'Higgins', descripcionExtranjera: 'O\'Higgins Region',                creadoEn: '2026-01-10T08:07:00Z' },
  { id: 9,  codigo: 'VII', descripcion: 'Región del Maule',                                 descripcionExtranjera: 'Maule Region',                     creadoEn: '2026-01-10T08:08:00Z' },
  { id: 10, codigo: 'XVI', descripcion: 'Región de Ñuble',                                  descripcionExtranjera: 'Ñuble Region',                     creadoEn: '2026-01-10T08:09:00Z' },
  { id: 11, codigo: 'VIII',descripcion: 'Región del Biobío',                                descripcionExtranjera: 'Biobío Region',                    creadoEn: '2026-01-10T08:10:00Z' },
  { id: 12, codigo: 'IX',  descripcion: 'Región de La Araucanía',                           descripcionExtranjera: 'Araucanía Region',                 creadoEn: '2026-01-10T08:11:00Z' },
  { id: 13, codigo: 'XIV', descripcion: 'Región de Los Ríos',                               descripcionExtranjera: 'Los Ríos Region',                  creadoEn: '2026-01-10T08:12:00Z' },
  { id: 14, codigo: 'X',   descripcion: 'Región de Los Lagos',                              descripcionExtranjera: 'Los Lagos Region',                 creadoEn: '2026-01-10T08:13:00Z' },
  { id: 15, codigo: 'XI',  descripcion: 'Región de Aysén del General Carlos Ibáñez del Campo', descripcionExtranjera: 'Aysén Region',                 creadoEn: '2026-01-10T08:14:00Z' },
  { id: 16, codigo: 'XII', descripcion: 'Región de Magallanes y de la Antártica Chilena',   descripcionExtranjera: 'Magallanes Region',                creadoEn: '2026-01-10T08:15:00Z' }
];

let store: Region[] = [...MOCK_REGIONES];
let nextId = store.length + 1;

export const fakeRegiones = {
  getRegiones(filters: { page?: number; limit?: number; q?: string; sort?: string }) {
    let result = [...store];

    if (filters.q) {
      const q = filters.q.toLowerCase();
      result = result.filter(
        (r) => r.descripcion.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q)
      );
    }

    const total = result.length;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const start = (page - 1) * limit;
    const regiones = result.slice(start, start + limit);

    return { regiones, total };
  },

  createRegion(data: Omit<Region, 'id' | 'creadoEn'>) {
    const region: Region = { ...data, id: nextId++, creadoEn: new Date().toISOString() };
    store.push(region);
    return region;
  },

  updateRegion(id: number, data: Partial<Region>) {
    store = store.map((r) => (r.id === id ? { ...r, ...data } : r));
    return store.find((r) => r.id === id);
  },

  deleteRegion(id: number) {
    store = store.filter((r) => r.id !== id);
  }
};
