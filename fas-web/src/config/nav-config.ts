import { NavGroup } from '@/types';

// ─── Reglas de diseño del menú ────────────────────────────────────────────────
//
// 1. MANTENEDORES EN SECCIÓN: cada sección operativa incluye un ítem "Mantenedores"
//    con los catálogos/maestros que son propios de esa sección.
//
// 2. MANTENEDORES GENERALES: los maestros transversales (geografía, fruta, parámetros,
//    operación general, configuración del sistema) viven en la sección "Gestión".
//
// 3. OPERACIONAL vs CATÁLOGO: los módulos de operación (Movimientos, Solicitudes, etc.)
//    son distintos de los catálogos que los parametrizan (Artículos, Tipos de Defecto…).
//
// ─────────────────────────────────────────────────────────────────────────────────

export const navGroups: NavGroup[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // INICIO
  // ═══════════════════════════════════════════════════════════════════════════
  {
    label: 'Inicio',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard/overview',
        icon: 'dashboard',
        isActive: false,
        shortcut: ['d', 'd'],
        items: []
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTIÓN COMERCIAL
  // Mantenedores propios: GrupoMercado · Mercado · TipoEmbarque
  // ═══════════════════════════════════════════════════════════════════════════
  {
    label: 'Gestión Comercial',
    items: [
      {
        title: 'Compras',
        url: '#',
        icon: 'compras',
        isActive: false,
        items: [
          { title: 'Solicitud de Inspección',    url: '/dashboard/calidad/solicitudes',    icon: 'calidad' },
          { title: 'Instructivo de Embalaje',    url: '/dashboard/compras/instructivos',   icon: 'forms'   },
          { title: 'Órdenes de Compra',          url: '/dashboard/compras/ordenes',         icon: 'post'    },
          { title: 'Recepción de Stock',         url: '/dashboard/compras/recepciones',    icon: 'bodega'  }
        ]
      },
      {
        title: 'Ventas',
        url: '#',
        icon: 'ventas',
        isActive: false,
        items: [
          { title: 'Cierre Comercial',   url: '/dashboard/ventas/notas',     icon: 'forms'   },
          { title: 'Embarques',         url: '/dashboard/ventas/embarques',  icon: 'post'    },
          { title: 'Cobranza / CRM',    url: '/dashboard/ventas/cobranza',   icon: 'billing' },
          { title: 'Reclamos',          url: '/dashboard/ventas/reclamos',   icon: 'warning' }
        ]
      },
      {
        title: 'Mantenedores',
        url: '#',
        icon: 'adjustments',
        isActive: false,
        items: [
          { title: 'Entidades',         url: '/dashboard/configuracion/entidades',      icon: 'teams'   },
          { title: 'Grupos de Mercado', url: '/dashboard/configuracion/grupos-mercado', icon: 'page'    },
          { title: 'Mercados',          url: '/dashboard/configuracion/mercados',        icon: 'page'    },
          { title: 'Tipos de Embarque', url: '/dashboard/configuracion/tipos-embarque', icon: 'page'    },
          { title: 'Formas de Pago',    url: '/dashboard/configuracion/formas-pago',    icon: 'billing' }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OPERACIONES
  // Mantenedores propios: Artículo · Receta · TipoMovimiento
  // ═══════════════════════════════════════════════════════════════════════════
  {
    label: 'Operaciones',
    items: [
      {
        title: 'Materiales',
        url: '#',
        icon: 'materiales',
        isActive: false,
        items: [
          { title: 'Órdenes de Compra', url: '/dashboard/operaciones/ordenes-compra', icon: 'post'           },
          { title: 'Movimientos',        url: '/dashboard/operaciones/movimientos',    icon: 'tiposMovimiento' }
        ]
      },
      {
        title: 'Mantenedores',
        url: '#',
        icon: 'adjustments',
        isActive: false,
        items: [
          { title: 'Entidades',           url: '/dashboard/configuracion/entidades',         icon: 'teams'           },
          { title: 'Artículos',           url: '/dashboard/configuracion/articulos',         icon: 'product'         },
          { title: 'Recetas',             url: '/dashboard/configuracion/recetas',           icon: 'recetas'         },
          { title: 'Tipos de Movimiento', url: '/dashboard/configuracion/tipos-movimiento',  icon: 'tiposMovimiento' }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTIÓN PRODUCTORES
  // Mantenedores propios: Productores (maestro) · ConceptoLiquidación · MatrizCostos
  // ═══════════════════════════════════════════════════════════════════════════
  {
    label: 'Gestión Productores',
    items: [
      {
        title: 'Productores',
        url: '#',
        icon: 'teams',
        isActive: false,
        items: [
          { title: 'Contrato',          url: '/dashboard/productores/contrato',         icon: 'post'         },
          { title: 'Cuenta Corriente',  url: '/dashboard/productores/cuenta-corriente', icon: 'billing'      },
          { title: 'Solicitud de Pago', url: '/dashboard/productores/pagos',            icon: 'trendingDown' }
        ]
      },
      {
        title: 'Liquidaciones',
        url: '#',
        icon: 'billing',
        isActive: false,
        items: [
          { title: 'Liquidación Clientes',  url: '/dashboard/liquidaciones/clientes',       icon: 'trendingUp' },
          { title: 'Ajustes de Precios',    url: '/dashboard/liquidaciones/ajustes-precios', icon: 'adjustments' },
          { title: 'Liquidación Productor', url: '/dashboard/liquidaciones/productores',    icon: 'post'       }
        ]
      },
      {
        title: 'Mantenedores',
        url: '#',
        icon: 'adjustments',
        isActive: false,
        items: [
          { title: 'Entidades',                url: '/dashboard/configuracion/entidades',              icon: 'teams'   },
          { title: 'Productores',              url: '/dashboard/configuracion/productores',            icon: 'teams'   },
          { title: 'Conceptos de Liquidación', url: '/dashboard/configuracion/conceptos-liquidacion', icon: 'forms'   },
          { title: 'Matriz de Costos',         url: '/dashboard/configuracion/matriz-costos',         icon: 'billing' }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CALIDAD
  // Ítems operativos directos (sin grupo wrapper).
  // Mantenedores propios: TipoDefecto · GrupoDefecto · Defecto · CaracteristicaMadurez
  // ═══════════════════════════════════════════════════════════════════════════
  {
    label: 'Calidad',
    items: [
      {
        title: 'Solicitud de Inspección',
        url: '/dashboard/calidad/solicitudes',
        icon: 'forms',
        isActive: false,
        items: []
      },
      {
        title: 'Inspección Compra',
        url: '/dashboard/calidad/inspeccion-compra',
        icon: 'calidad',
        isActive: false,
        items: []
      },
      {
        title: 'Inspección Proceso',
        url: '/dashboard/calidad/inspeccion-proceso',
        icon: 'calidad',
        isActive: false,
        items: []
      },
      {
        title: 'Mantenedores',
        url: '#',
        icon: 'adjustments',
        isActive: false,
        items: [
          { title: 'Tipos de Defecto',         url: '/dashboard/configuracion/tipos-defecto',            icon: 'page'  },
          { title: 'Grupos de Defecto',         url: '/dashboard/configuracion/grupos-defecto',          icon: 'page'  },
          { title: 'Defectos',                  url: '/dashboard/configuracion/defectos',                icon: 'page'  },
          { title: 'Características Madurez',   url: '/dashboard/configuracion/caracteristicas-madurez', icon: 'forms' },
          { title: 'Motivos de Inspección',     url: '/dashboard/configuracion/motivos-inspeccion',      icon: 'page'  }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANZAS — ítems directos (sin repetir "Finanzas › Finanzas")
  // ═══════════════════════════════════════════════════════════════════════════
  {
    label: 'Finanzas',
    items: [
      { title: 'Gestión de Costos', url: '/dashboard/finanzas/costos',      icon: 'trendingDown', isActive: false, items: [] },
      { title: 'Gestión de Pagos',  url: '/dashboard/finanzas/pagos',       icon: 'billing',      isActive: false, items: [] },
      { title: 'Facturación (DTE)', url: '/dashboard/finanzas/facturacion', icon: 'post',         isActive: false, items: [] }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    label: 'Reportes',
    items: [
      { title: 'Stock Fruta',       url: '/dashboard/reportes/stock-fruta',      icon: 'bodega',     isActive: false, items: [] },
      { title: 'Stock Materiales',  url: '/dashboard/reportes/stock-materiales', icon: 'materiales', isActive: false, items: [] },
      { title: 'Stock por Receta',  url: '/dashboard/reportes/stock-receta',     icon: 'recetas',    isActive: false, items: [] }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN — hub central de todos los mantenedores, agrupados por área
  //
  // Cada subsección replica los maestros de la sección operativa correspondiente
  // para que el administrador tenga acceso directo desde un único punto.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    label: 'Configuración',
    items: [

      // ── Gestión Comercial ────────────────────────────────────────────────
      {
        title: 'Gestión Comercial',
        url: '#',
        icon: 'ventas',
        isActive: false,
        items: [
          { title: 'Entidades',         url: '/dashboard/configuracion/entidades',      icon: 'teams'   },
          { title: 'Grupos de Mercado', url: '/dashboard/configuracion/grupos-mercado', icon: 'page'    },
          { title: 'Mercados',          url: '/dashboard/configuracion/mercados',        icon: 'page'    },
          { title: 'Tipos de Embarque', url: '/dashboard/configuracion/tipos-embarque', icon: 'page'    },
          { title: 'Puertos',           url: '/dashboard/configuracion/puertos',         icon: 'page'    },
          { title: 'Formas de Pago',    url: '/dashboard/configuracion/formas-pago',    icon: 'billing' }
        ]
      },

      // ── Materiales ───────────────────────────────────────────────────────
      {
        title: 'Materiales',
        url: '#',
        icon: 'materiales',
        isActive: false,
        items: [
          { title: 'Entidades',  url: '/dashboard/configuracion/entidades', icon: 'teams'   },
          { title: 'Artículos',  url: '/dashboard/configuracion/articulos', icon: 'product' },
          { title: 'Recetas',    url: '/dashboard/configuracion/recetas',   icon: 'recetas' }
        ]
      },

      // ── Gestión Productores ──────────────────────────────────────────────
      {
        title: 'Gestión Productores',
        url: '#',
        icon: 'teams',
        isActive: false,
        items: [
          { title: 'Entidades',                url: '/dashboard/configuracion/entidades',              icon: 'teams'   },
          { title: 'Productores',              url: '/dashboard/configuracion/productores',            icon: 'teams'   },
          { title: 'Conceptos de Liquidación', url: '/dashboard/configuracion/conceptos-liquidacion', icon: 'forms'   },
          { title: 'Conceptos Cta. Cte.',      url: '/dashboard/configuracion/conceptos-cta-cte',     icon: 'billing' },
          { title: 'Matriz de Costos',         url: '/dashboard/configuracion/matriz-costos',         icon: 'billing' }
        ]
      },

      // ── Calidad ──────────────────────────────────────────────────────────
      {
        title: 'Calidad',
        url: '#',
        icon: 'calidad',
        isActive: false,
        items: [
          { title: 'Tipos de Defecto',       url: '/dashboard/configuracion/tipos-defecto',            icon: 'page'  },
          { title: 'Grupos de Defecto',      url: '/dashboard/configuracion/grupos-defecto',           icon: 'page'  },
          { title: 'Defectos',               url: '/dashboard/configuracion/defectos',                 icon: 'page'  },
          { title: 'Características Madurez',url: '/dashboard/configuracion/caracteristicas-madurez',  icon: 'forms' },
          { title: 'Motivos de Inspección',  url: '/dashboard/configuracion/motivos-inspeccion',       icon: 'page'  }
        ]
      },

      // ── Geográfico ──────────────────────────────────────────────────────
      {
        title: 'Geográfico',
        url: '#',
        icon: 'page',
        isActive: false,
        items: [
          { title: 'Zonas',      url: '/dashboard/configuracion/zonas',      icon: 'page' },
          { title: 'Países',     url: '/dashboard/configuracion/paises',     icon: 'page' },
          { title: 'Regiones',   url: '/dashboard/configuracion/regiones',   icon: 'page' },
          { title: 'Provincias', url: '/dashboard/configuracion/provincias', icon: 'page' },
          { title: 'Comunas',    url: '/dashboard/configuracion/comunas',    icon: 'page' }
        ]
      },

      // ── Operación general ────────────────────────────────────────────────
      {
        title: 'Operación',
        url: '#',
        icon: 'operaciones',
        isActive: false,
        items: [
          { title: 'Tipos de Pallet',     url: '/dashboard/configuracion/tipos-pallet',     icon: 'page'        },
          { title: 'Alturas',             url: '/dashboard/configuracion/alturas',           icon: 'page'        },
          { title: 'Tipos de Producción', url: '/dashboard/configuracion/tipos-produccion', icon: 'adjustments' }
        ]
      },

      // ── Fruta ────────────────────────────────────────────────────────────
      {
        title: 'Fruta',
        url: '#',
        icon: 'leaf',
        isActive: false,
        items: [
          { title: 'Especies',           url: '/dashboard/configuracion/especies',         icon: 'leaf' },
          { title: 'Grupos de Variedad', url: '/dashboard/configuracion/grupos-variedad',  icon: 'page' },
          { title: 'Variedades',         url: '/dashboard/configuracion/variedades',       icon: 'page' },
          { title: 'Categorías',         url: '/dashboard/configuracion/categorias',       icon: 'page' },
          { title: 'Calibres',           url: '/dashboard/configuracion/calibres',         icon: 'page' }
        ]
      },

      // ── Sistema ──────────────────────────────────────────────────────────
      {
        title: 'Sistema',
        url: '#',
        icon: 'settings',
        isActive: false,
        items: [
          { title: 'Usuarios',              url: '/dashboard/configuracion/usuarios',          icon: 'user2'           },
          { title: 'Perfiles',              url: '/dashboard/configuracion/perfiles',          icon: 'lock'            },
          { title: 'Bodegas',               url: '/dashboard/configuracion/bodegas',           icon: 'bodega'          },
          { title: 'Unidades de Medida',    url: '/dashboard/configuracion/unidades-medida',   icon: 'page'            },
          { title: 'Tipos de Movimiento',   url: '/dashboard/configuracion/tipos-movimiento',  icon: 'tiposMovimiento' },
          { title: 'Temporadas',            url: '/dashboard/configuracion/temporadas',        icon: 'calendar'        },
          { title: 'Monedas',               url: '/dashboard/configuracion/monedas',           icon: 'billing'         },
          { title: 'Tipos de Parámetro',    url: '/dashboard/configuracion/tipos-parametro',   icon: 'page'            },
          { title: 'Parámetros',            url: '/dashboard/configuracion/parametros',        icon: 'adjustments'     },
          { title: 'Configuración General', url: '/dashboard/configuracion/general',           icon: 'settings'        }
        ]
      },

      // ── Mi Cuenta ────────────────────────────────────────────────────────
      {
        title: 'Mi Cuenta',
        url: '#',
        icon: 'account',
        isActive: false,
        items: [
          { title: 'Perfil',         url: '/dashboard/profile',       icon: 'profile',     shortcut: ['m', 'm'] },
          { title: 'Notificaciones', url: '/dashboard/notifications', icon: 'notification' }
        ]
      }
    ]
  }
];
