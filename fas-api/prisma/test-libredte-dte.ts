// Script de prueba manual del adapter LibreDTE (facturacion/libredte.adapter.ts)
// contra el ambiente de CERTIFICACIÓN. No es parte del flujo de negocio de
// Facturación (aún sin spec, ver CLAUDE.md) — sirve para validar la
// integración con LibreDTE (credenciales, conectividad, forma del payload)
// con un DTE de prueba antes de construir el módulo real.
//
// Uso:
//   tsx prisma/test-libredte-dte.ts [CODIGO_EMPRESA] [--generar]
//
// Requiere en el entorno (ver .env.example):
//   LIBREDTE_API_HASH      hash de tu perfil LibreDTE (obligatorio)
//   LIBREDTE_URL           default https://libredte.cl
//   LIBREDTE_RUT_EMISOR    RUT emisor de prueba, ej. 76192083-9 (obligatorio)
//   LIBREDTE_RUT_RECEPTOR  default 66666666-6 (RUT genérico de prueba SII)
//
// Paso 1 (default): solo emitirTemporal() — crea el borrador, NO consume folio.
// Paso 2 (--generar): además llama a generarReal() — esto SÍ timbra con un
// folio real (de certificación) y puede enviar al SII. Requiere folios CAF
// cargados en LibreDTE para el tipo de DTE usado.
import { prisma } from '../src/lib/prisma.js'
import { empresaContext } from '../src/lib/empresa-context.js'
import * as integracionesService from '../src/modules/config/integraciones/integraciones.service.js'
import * as integracionesRepo from '../src/modules/config/integraciones/integraciones.repository.js'
import * as libredte from '../src/modules/finanzas/facturacion/libredte.adapter.js'
import type { LibredteDtePayload } from '../src/modules/finanzas/facturacion/libredte.types.js'

const USER = 'sistema'
const CODIGO_INTEGRACION = 'LIBREDTE'

function rutSinDv(rut: string): number {
  const limpio = rut.replace(/\./g, '').trim()
  const sinDv = limpio.includes('-') ? limpio.split('-')[0] : limpio.slice(0, -1)
  const n = Number(sinDv)
  if (!Number.isFinite(n)) throw new Error(`RUT inválido: "${rut}"`)
  return n
}

async function ensureIntegracion(hash: string, url: string | undefined) {
  const existente = await integracionesRepo.findIntegracionByCodigo(CODIGO_INTEGRACION)
  if (existente) {
    console.log(`Integración "${CODIGO_INTEGRACION}" ya existe (id=${existente.id}) — se reutiliza tal cual está configurada.`)
    return
  }
  const creada = await integracionesService.crearIntegracion(
    { codigo: CODIGO_INTEGRACION, descripcion: 'LibreDTE — Documentos Tributarios Electrónicos', url: url ?? null, activo: true },
    USER,
  )
  await integracionesService.agregarParametro(creada!.id, {
    idExterno: 'API_HASH',
    tipo: 'TEXTO',
    valorExterno: hash,
    sensible: true,
    descripcion: 'Hash de autenticación (perfil LibreDTE → API Key)',
  })
  console.log(`Integración "${CODIGO_INTEGRACION}" creada (id=${creada!.id}).`)
}

function buildDtePrueba(rutEmisor: string, rutReceptor: string): LibredteDtePayload {
  return {
    Encabezado: {
      IdDoc: { TipoDTE: 39 }, // Boleta electrónica — mismo ejemplo de la doc oficial de LibreDTE
      Emisor: { RUTEmisor: rutEmisor },
      Receptor: {
        RUTRecep: rutReceptor,
        RznSocRecep: 'Cliente de Prueba FAS',
        GiroRecep: 'Pruebas de integración',
        DirRecep: 'Santa Cruz',
        CmnaRecep: 'Santa Cruz',
      },
    },
    Detalle: [
      { IndExe: 0, NmbItem: 'Producto de Prueba FAS', QtyItem: 1, PrcItem: 1000 },
    ],
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const generar = process.argv.includes('--generar')
  const codigoEmpresa = args[0] ?? 'AGROSAN'

  const hash = process.env.LIBREDTE_API_HASH
  const rutEmisor = process.env.LIBREDTE_RUT_EMISOR
  const rutReceptor = process.env.LIBREDTE_RUT_RECEPTOR ?? '66666666-6'
  const url = process.env.LIBREDTE_URL

  if (!hash) throw new Error('Falta LIBREDTE_API_HASH en el entorno (.env) — hash de tu perfil LibreDTE.')
  if (!rutEmisor) throw new Error('Falta LIBREDTE_RUT_EMISOR en el entorno (.env) — RUT emisor de prueba, ej. 76192083-9.')

  const empresa = await prisma.empresa.findFirst({ where: { codigo: codigoEmpresa } })
  if (!empresa) throw new Error(`No se encontró la empresa "${codigoEmpresa}".`)

  await empresaContext.run({ empresaId: empresa.id }, async () => {
    await ensureIntegracion(hash, url)

    console.log(`\nEmitiendo DTE temporal de prueba (Boleta electrónica, emisor ${rutEmisor} -> receptor ${rutReceptor})...`)
    const payload = buildDtePrueba(rutEmisor, rutReceptor)
    const resultado = await libredte.emitirTemporal(payload, { normalizar: '1', formato: 'json' })
    console.log('Resultado emitirTemporal:', JSON.stringify(resultado, null, 2))

    if (!resultado.ok) {
      throw new Error(`emitirTemporal falló: ${resultado.error}`)
    }

    const codigoTemporal = resultado.data?.codigo
    if (!codigoTemporal) {
      console.warn('La respuesta no trajo "codigo" — revisa el JSON de arriba para ubicarlo manualmente.')
      return
    }
    console.log(`\nDTE temporal creado. codigo=${codigoTemporal}`)

    if (!generar) {
      console.log('\n(Usa --generar para además timbrar el DTE real — esto consume un folio CAF de certificación.)')
      return
    }

    console.log('\nGenerando DTE real a partir del temporal (--generar)...')
    const generado = await libredte.generarReal(
      {
        codigo: codigoTemporal,
        dte: payload.Encabezado.IdDoc.TipoDTE,
        emisor: rutSinDv(rutEmisor),
        receptor: rutSinDv(rutReceptor),
      },
      { getXML: '0', retry: '1' },
    )
    console.log('Resultado generarReal:', JSON.stringify(generado, null, 2))
    if (!generado.ok) throw new Error(`generarReal falló: ${generado.error}`)
  })
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('\nError:', err instanceof Error ? err.message : err)
    return prisma.$disconnect().finally(() => process.exit(1))
  })
