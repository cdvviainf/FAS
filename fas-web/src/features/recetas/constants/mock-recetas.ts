import type { Receta } from '../api/types';

export const MOCK_RECETAS: Receta[] = [
  {
    id: 1,
    codigo: 'REC-001',
    descripcion: 'Receta Uva Madera Exportación',
    embalajeId: 1,
    embalajeCodigo: 'EMB-001',
    embalajeDescripcion: 'Caja Madera Uva 8.2 kg',
    cantidadAProducir: 100,
    activo: true,
    cantidadComponentes: 4,
    detalle: [
      { id: 1, componenteId: 6, componenteCodigo: 'MAT-001', componenteDescripcion: 'Papel Tissue Uva', componenteUnidad: 'UN', cantidadAConsumir: 100 },
      { id: 2, componenteId: 7, componenteCodigo: 'MAT-002', componenteDescripcion: 'Etiqueta Exportación Premium', componenteUnidad: 'UN', cantidadAConsumir: 100 },
      { id: 3, componenteId: 8, componenteCodigo: 'MAT-003', componenteDescripcion: 'Zuncho Plástico 12 mm', componenteUnidad: 'MTS', cantidadAConsumir: 50 },
      { id: 4, componenteId: 11, componenteCodigo: 'SRV-002', componenteDescripcion: 'Mano de Obra Embalaje', componenteUnidad: 'HRS', cantidadAConsumir: 0.25 }
    ],
    creadoEn: '2026-01-15T08:00:00Z'
  },
  {
    id: 2,
    codigo: 'REC-002',
    descripcion: 'Receta Cereza Cartón Premium',
    embalajeId: 2,
    embalajeCodigo: 'EMB-002',
    embalajeDescripcion: 'Caja Cartón Cereza 5 kg',
    cantidadAProducir: 100,
    activo: true,
    cantidadComponentes: 3,
    detalle: [
      { id: 5, componenteId: 7, componenteCodigo: 'MAT-002', componenteDescripcion: 'Etiqueta Exportación Premium', componenteUnidad: 'UN', cantidadAConsumir: 100 },
      { id: 6, componenteId: 8, componenteCodigo: 'MAT-003', componenteDescripcion: 'Zuncho Plástico 12 mm', componenteUnidad: 'MTS', cantidadAConsumir: 30 },
      { id: 7, componenteId: 11, componenteCodigo: 'SRV-002', componenteDescripcion: 'Mano de Obra Embalaje', componenteUnidad: 'HRS', cantidadAConsumir: 0.15 }
    ],
    creadoEn: '2026-01-16T09:00:00Z'
  },
  {
    id: 3,
    codigo: 'REC-003',
    descripcion: 'Receta Carozos Cartón Básica',
    embalajeId: 3,
    embalajeCodigo: 'EMB-003',
    embalajeDescripcion: 'Caja Cartón Carozos 4 kg',
    cantidadAProducir: 100,
    activo: true,
    cantidadComponentes: 2,
    detalle: [
      { id: 8, componenteId: 7, componenteCodigo: 'MAT-002', componenteDescripcion: 'Etiqueta Exportación Premium', componenteUnidad: 'UN', cantidadAConsumir: 100 },
      { id: 9, componenteId: 11, componenteCodigo: 'SRV-002', componenteDescripcion: 'Mano de Obra Embalaje', componenteUnidad: 'HRS', cantidadAConsumir: 0.10 }
    ],
    creadoEn: '2026-01-17T10:00:00Z'
  },
  {
    id: 4,
    codigo: 'REC-004',
    descripcion: 'Receta Uva Madera con Preenfriado',
    embalajeId: 1,
    embalajeCodigo: 'EMB-001',
    embalajeDescripcion: 'Caja Madera Uva 8.2 kg',
    cantidadAProducir: 100,
    activo: true,
    cantidadComponentes: 5,
    detalle: [
      { id: 10, componenteId: 6, componenteCodigo: 'MAT-001', componenteDescripcion: 'Papel Tissue Uva', componenteUnidad: 'UN', cantidadAConsumir: 100 },
      { id: 11, componenteId: 7, componenteCodigo: 'MAT-002', componenteDescripcion: 'Etiqueta Exportación Premium', componenteUnidad: 'UN', cantidadAConsumir: 100 },
      { id: 12, componenteId: 8, componenteCodigo: 'MAT-003', componenteDescripcion: 'Zuncho Plástico 12 mm', componenteUnidad: 'MTS', cantidadAConsumir: 50 },
      { id: 13, componenteId: 10, componenteCodigo: 'SRV-001', componenteDescripcion: 'Servicio Pre-enfriado (túnel)', componenteUnidad: 'HRS', cantidadAConsumir: 0.5 },
      { id: 14, componenteId: 11, componenteCodigo: 'SRV-002', componenteDescripcion: 'Mano de Obra Embalaje', componenteUnidad: 'HRS', cantidadAConsumir: 0.25 }
    ],
    creadoEn: '2026-01-18T08:00:00Z'
  },
  {
    id: 5,
    codigo: 'REC-005',
    descripcion: 'Receta Cereza Cartón con Flete',
    embalajeId: 2,
    embalajeCodigo: 'EMB-002',
    embalajeDescripcion: 'Caja Cartón Cereza 5 kg',
    cantidadAProducir: 50,
    activo: false,
    cantidadComponentes: 3,
    detalle: [
      { id: 15, componenteId: 7, componenteCodigo: 'MAT-002', componenteDescripcion: 'Etiqueta Exportación Premium', componenteUnidad: 'UN', cantidadAConsumir: 50 },
      { id: 16, componenteId: 11, componenteCodigo: 'SRV-002', componenteDescripcion: 'Mano de Obra Embalaje', componenteUnidad: 'HRS', cantidadAConsumir: 0.10 },
      { id: 17, componenteId: 12, componenteCodigo: 'SRV-003', componenteDescripcion: 'Flete Interno Bodega', componenteUnidad: 'UN', cantidadAConsumir: 1 }
    ],
    creadoEn: '2026-01-20T11:00:00Z'
  }
];

let store: Receta[] = [...MOCK_RECETAS];
let nextId = store.length + 1;
let nextDetalleId = 20;

export const fakeRecetas = {
  getRecetas(filters: { page?: number; limit?: number; q?: string; sort?: string }) {
    let result = [...store];

    if (filters.q) {
      const q = filters.q.toLowerCase();
      result = result.filter(
        (r) =>
          r.codigo.toLowerCase().includes(q) ||
          r.descripcion.toLowerCase().includes(q) ||
          r.embalajeDescripcion.toLowerCase().includes(q)
      );
    }

    const total = result.length;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const start = (page - 1) * limit;
    const recetas = result.slice(start, start + limit);

    return { recetas, total };
  },

  createReceta(data: Omit<Receta, 'id' | 'creadoEn' | 'cantidadComponentes'>) {
    const receta: Receta = {
      ...data,
      id: nextId++,
      cantidadComponentes: data.detalle.length,
      detalle: data.detalle.map((d) => ({
        ...d,
        id: nextDetalleId++
      })),
      creadoEn: new Date().toISOString()
    };
    store.push(receta);
    return receta;
  },

  updateReceta(id: number, data: Partial<Omit<Receta, 'id' | 'creadoEn'>>) {
    store = store.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, ...data };
      if (data.detalle) {
        updated.cantidadComponentes = data.detalle.length;
        updated.detalle = data.detalle.map((d) => ({
          ...d,
          id: d.id ?? nextDetalleId++
        }));
      }
      return updated;
    });
    return store.find((r) => r.id === id);
  },

  deleteReceta(id: number) {
    store = store.map((r) => (r.id === id ? { ...r, activo: false } : r));
  }
};
