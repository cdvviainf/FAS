import type { Articulo } from '../api/types';

export const MOCK_ARTICULOS: Articulo[] = [
  {
    id: 1,
    tipo: 'EMBALAJE',
    codigo: 'EMB-001',
    descripcion: 'Caja Madera Uva 8.2 kg',
    descripcionExtranjera: 'Wood Box Grape 8.2 kg',
    unidad: 'UN',
    tipoCosteo: 'PROMEDIO_PONDERADO',
    controlaStock: true,
    stockCritico: 500,
    activo: true,
    creadoEn: '2026-01-10T08:00:00Z'
  },
  {
    id: 2,
    tipo: 'EMBALAJE',
    codigo: 'EMB-002',
    descripcion: 'Caja Cartón Cereza 5 kg',
    descripcionExtranjera: 'Cardboard Box Cherry 5 kg',
    unidad: 'UN',
    tipoCosteo: 'PROMEDIO_PONDERADO',
    controlaStock: true,
    stockCritico: 300,
    activo: true,
    creadoEn: '2026-01-10T08:10:00Z'
  },
  {
    id: 3,
    tipo: 'EMBALAJE',
    codigo: 'EMB-003',
    descripcion: 'Caja Cartón Carozos 4 kg',
    descripcionExtranjera: 'Cardboard Box Stone Fruit 4 kg',
    unidad: 'UN',
    tipoCosteo: 'PROMEDIO_PONDERADO',
    controlaStock: true,
    stockCritico: 200,
    activo: true,
    creadoEn: '2026-01-11T09:00:00Z'
  },
  {
    id: 4,
    tipo: 'ENVASE',
    codigo: 'ENV-001',
    descripcion: 'Bolsa Polietileno Uva 2 kg',
    unidad: 'UN',
    tipoCosteo: 'PROMEDIO_PONDERADO',
    controlaStock: true,
    stockCritico: 2000,
    activo: true,
    creadoEn: '2026-01-12T10:00:00Z'
  },
  {
    id: 5,
    tipo: 'ENVASE',
    codigo: 'ENV-002',
    descripcion: 'Bandeja PVC Cereza 500 g',
    unidad: 'UN',
    tipoCosteo: 'PROMEDIO_PONDERADO',
    controlaStock: true,
    stockCritico: 1500,
    activo: true,
    creadoEn: '2026-01-12T10:30:00Z'
  },
  {
    id: 6,
    tipo: 'MATERIAL_EMBALAJE',
    codigo: 'MAT-001',
    descripcion: 'Papel Tissue Uva',
    unidad: 'UN',
    tipoCosteo: 'PROMEDIO_PONDERADO',
    controlaStock: true,
    stockCritico: 10000,
    activo: true,
    creadoEn: '2026-01-13T11:00:00Z'
  },
  {
    id: 7,
    tipo: 'MATERIAL_EMBALAJE',
    codigo: 'MAT-002',
    descripcion: 'Etiqueta Exportación Premium',
    unidad: 'UN',
    tipoCosteo: 'ESTANDAR',
    valorEstandar: 25,
    controlaStock: false,
    activo: true,
    creadoEn: '2026-01-13T11:30:00Z'
  },
  {
    id: 8,
    tipo: 'MATERIAL_EMBALAJE',
    codigo: 'MAT-003',
    descripcion: 'Zuncho Plástico 12 mm',
    unidad: 'MTS',
    tipoCosteo: 'PROMEDIO_PONDERADO',
    controlaStock: true,
    stockCritico: 500,
    activo: true,
    creadoEn: '2026-01-14T08:00:00Z'
  },
  {
    id: 9,
    tipo: 'MATERIAL_EMBALAJE',
    codigo: 'MAT-004',
    descripcion: 'Grapas Caja Madera',
    unidad: 'UN',
    tipoCosteo: 'PROMEDIO_PONDERADO',
    controlaStock: true,
    stockCritico: 5000,
    activo: false,
    creadoEn: '2026-01-14T09:00:00Z'
  },
  {
    id: 10,
    tipo: 'SERVICIO',
    codigo: 'SRV-001',
    descripcion: 'Servicio Pre-enfriado (túnel)',
    unidad: 'HRS',
    tipoCosteo: 'ESTANDAR',
    valorEstandar: 15000,
    controlaStock: false,
    activo: true,
    creadoEn: '2026-01-15T08:00:00Z'
  },
  {
    id: 11,
    tipo: 'SERVICIO',
    codigo: 'SRV-002',
    descripcion: 'Mano de Obra Embalaje',
    unidad: 'HRS',
    tipoCosteo: 'ESTANDAR',
    valorEstandar: 8500,
    controlaStock: false,
    activo: true,
    creadoEn: '2026-01-15T08:30:00Z'
  },
  {
    id: 12,
    tipo: 'SERVICIO',
    codigo: 'SRV-003',
    descripcion: 'Flete Interno Bodega',
    unidad: 'UN',
    tipoCosteo: 'ESTANDAR',
    valorEstandar: 25000,
    controlaStock: false,
    activo: true,
    creadoEn: '2026-01-15T09:00:00Z'
  }
];

// In-memory store for CRUD mock operations
let store: Articulo[] = [...MOCK_ARTICULOS];
let nextId = store.length + 1;

export const fakeArticulos = {
  getArticulos(filters: {
    page?: number;
    limit?: number;
    q?: string;
    tipo?: string;
    sort?: string;
  }) {
    let result = [...store];

    if (filters.q) {
      const q = filters.q.toLowerCase();
      result = result.filter(
        (a) =>
          a.descripcion.toLowerCase().includes(q) || a.codigo.toLowerCase().includes(q)
      );
    }

    if (filters.tipo) {
      const tipos = filters.tipo.split('.');
      result = result.filter((a) => tipos.includes(a.tipo));
    }

    const total = result.length;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const start = (page - 1) * limit;
    const articulos = result.slice(start, start + limit);

    return { articulos, total };
  },

  createArticulo(data: Omit<Articulo, 'id' | 'creadoEn'>) {
    const articulo: Articulo = {
      ...data,
      id: nextId++,
      creadoEn: new Date().toISOString()
    };
    store.push(articulo);
    return articulo;
  },

  updateArticulo(id: number, data: Partial<Articulo>) {
    store = store.map((a) => (a.id === id ? { ...a, ...data } : a));
    return store.find((a) => a.id === id);
  },

  deleteArticulo(id: number) {
    store = store.map((a) => (a.id === id ? { ...a, activo: false } : a));
  }
};
