import type { HojaSpec } from '../../../lib/carga-maestros/tipos.js'

// ─── Registro de Carga Masiva: Direcciones y Contactos de Entidad ────────────
//
// Archivo dedicado (separado de la Carga Masiva de Maestros, que excluye
// explícitamente direcciones/contactos). Reutiliza el mismo motor declarativo:
//   - Hojas de datos: Direcciones, Contactos (una fila = un registro a crear).
//   - Hojas de SOLO REFERENCIA (pestaña gris): Entidades, Comunas, Paises. El
//     generador las llena con lo que YA existe en la BD para que el usuario
//     copie los códigos correctos; el cargador las ignora.
//
// FKs: la Entidad, la Comuna y el País ya deben existir (externo). El código de
// dirección/contacto se autogenera vía PrefijoCodigo (entidadDireccion /
// entidadContacto) si se deja vacío.

export const REGISTRO_ENTIDADES_DETALLE: HojaSpec[] = [
  // ─── Hojas de referencia (se llenan desde la BD) ────────────────────────────
  {
    hoja: 'Entidades',
    titulo: 'Entidades (referencia)',
    descripcion: 'Entidades existentes. Copia el "Código" en las hojas Direcciones/Contactos.',
    dependeDe: [],
    soloReferencia: true,
    columnas: [
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto' },
      { encabezado: 'Nombre', campo: 'descripcion', tipo: 'texto' },
      { encabezado: 'Razón Social', campo: 'razonSocial', tipo: 'texto' },
      { encabezado: 'País', campo: 'pais', tipo: 'texto' },
    ],
  },
  {
    hoja: 'Comunas',
    titulo: 'Comunas (referencia)',
    descripcion: 'Comunas existentes (Chile). Copia el "Código" en la columna Comuna de Direcciones.',
    dependeDe: [],
    soloReferencia: true,
    columnas: [
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto' },
      { encabezado: 'Nombre', campo: 'descripcion', tipo: 'texto' },
    ],
  },
  {
    hoja: 'Paises',
    titulo: 'Países (referencia)',
    descripcion: 'Países existentes. Solo si la dirección NO usa el país de la entidad.',
    dependeDe: [],
    soloReferencia: true,
    columnas: [
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto' },
      { encabezado: 'Nombre', campo: 'descripcion', tipo: 'texto' },
    ],
  },

  // ─── Hojas de datos ─────────────────────────────────────────────────────────
  {
    hoja: 'Direcciones',
    modelo: 'entidadDireccion',
    titulo: 'Direcciones',
    descripcion: 'Direcciones por entidad. La Entidad y la Comuna YA DEBEN EXISTIR. Si dejas el País vacío, se usa el país de la entidad.',
    dependeDe: ['Entidades'],
    codigoUnicoGlobal: false, // el código de dirección es único por entidad
    columnas: [
      { encabezado: 'Entidad (código)', campo: 'entidadId', tipo: 'fk', requerido: true, fk: { hoja: 'Entidades', externo: true, modelo: 'entidad' }, ayuda: 'Código de la hoja Entidades (referencia).' },
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true, ayuda: 'Vacío = se autogenera (prefijo entidadDireccion). Único por entidad.' },
      { encabezado: 'Descripción', campo: 'descripcion', tipo: 'texto', requerido: true, ayuda: 'Etiqueta legible. Ej. Casa matriz, Bodega Norte.' },
      { encabezado: 'Dirección', campo: 'direccion', tipo: 'textoLargo', requerido: true },
      { encabezado: 'País (código, opcional)', campo: 'paisId', tipo: 'fk', fk: { hoja: 'Paises', externo: true, modelo: 'pais' }, ayuda: 'Vacío = país de la entidad. La comuna solo aplica a Chile.' },
      { encabezado: 'Comuna (código, solo Chile, opcional)', campo: 'comunaId', tipo: 'fk', fk: { hoja: 'Comunas', externo: true, modelo: 'comuna' } },
      { encabezado: 'Por Defecto (SI/NO)', campo: 'esPorDefecto', tipo: 'booleanSiNo', ayuda: 'Marca la dirección principal de la entidad.' },
      { encabezado: 'Latitud', campo: 'latitud', tipo: 'decimal' },
      { encabezado: 'Longitud', campo: 'longitud', tipo: 'decimal' },
    ],
  },
  {
    hoja: 'Contactos',
    modelo: 'entidadContacto',
    titulo: 'Contactos',
    descripcion: 'Contactos por entidad. La Entidad YA DEBE EXISTIR.',
    dependeDe: ['Entidades'],
    codigoUnicoGlobal: false, // el código de contacto es único por entidad
    columnas: [
      { encabezado: 'Entidad (código)', campo: 'entidadId', tipo: 'fk', requerido: true, fk: { hoja: 'Entidades', externo: true, modelo: 'entidad' }, ayuda: 'Código de la hoja Entidades (referencia).' },
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true, ayuda: 'Vacío = se autogenera (prefijo entidadContacto). Único por entidad.' },
      { encabezado: 'Nombre', campo: 'nombre', tipo: 'texto', requerido: true },
      { encabezado: 'RUT', campo: 'rut', tipo: 'texto', ayuda: 'Obligatorio si es Representante Legal (RUT chileno válido).' },
      { encabezado: 'WhatsApp', campo: 'whatsapp', tipo: 'texto' },
      { encabezado: 'Email', campo: 'email', tipo: 'texto' },
      { encabezado: 'Teléfono', campo: 'telefono', tipo: 'texto' },
      { encabezado: 'Tipo', campo: 'tipo', tipo: 'texto', ayuda: 'Ej. Ventas, Finanzas, Operaciones.' },
      { encabezado: 'Es Representante Legal (SI/NO)', campo: 'esRepresentanteLegal', tipo: 'booleanSiNo', ayuda: 'Si SI: requiere RUT válido y solo uno por entidad.' },
    ],
  },
]
