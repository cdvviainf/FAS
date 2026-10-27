'use client'

import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { cargaRecetasService } from '../service'
import type { ResultadoCarga } from '../types'

const ITEM = 'MATERIALES_CARGA_RECETAS'

export function CargaRecetasClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null)

  const templateMut = useMutation({
    mutationFn: (conEjemplo: boolean) => cargaRecetasService.descargarTemplate(conEjemplo),
    onError: (e: Error) => toast.error(e.message || 'No se pudo descargar la plantilla'),
  })

  const procesarMut = useMutation({
    mutationFn: (commit: boolean) => cargaRecetasService.procesar(archivo!, commit),
    onSuccess: (data, commit) => {
      setResultado(data)
      const recetas = data.resumen.Recetas?.creados ?? 0
      const detalles = data.resumen.Componentes?.creados ?? 0
      if (commit) toast.success(`Carga completada: ${recetas} recetas (${detalles} componentes), ${data.errores.length} con error`)
      else toast.info(`Validación: ${data.errores.length} problemas encontrados`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al procesar el archivo'),
  })

  const reporteMut = useMutation({
    mutationFn: () => cargaRecetasService.descargarReporte(archivo!),
    onError: (e: Error) => toast.error(e.message || 'No se pudo descargar el reporte'),
  })

  const recetasCreadas = resultado?.resumen.Recetas?.creados ?? 0

  return (
    <div className='flex flex-col gap-6'>
      {/* Paso 1: plantilla */}
      <Card>
        <CardHeader>
          <CardTitle>1. Plantilla</CardTitle>
          <CardDescription>
            Descarga el Excel base (una fila por componente). Repite el código de receta y los datos
            de cabecera (Embalaje, Descripción, Cantidad a Producir) en cada fila de la misma receta. Incluye una
            hoja de referencia <strong>Embalajes</strong> con los artículos existentes y un desplegable en la columna
            Embalaje. El Embalaje y los componentes deben existir previamente como Artículos.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-wrap gap-3'>
          <Button
            variant='outline'
            onClick={() => templateMut.mutate(false)}
            disabled={templateMut.isPending}
          >
            {templateMut.isPending && templateMut.variables === false && (
              <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
            )}
            {!(templateMut.isPending && templateMut.variables === false) && <Icons.download className='mr-2 h-4 w-4' />}
            Descargar plantilla
          </Button>
          <Button
            variant='ghost'
            onClick={() => templateMut.mutate(true)}
            disabled={templateMut.isPending}
          >
            {templateMut.isPending && templateMut.variables === true && (
              <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
            )}
            {!(templateMut.isPending && templateMut.variables === true) && <Icons.download className='mr-2 h-4 w-4' />}
            Descargar con ejemplo
          </Button>
        </CardContent>
      </Card>

      {/* Paso 2: subir + procesar */}
      <Card>
        <CardHeader>
          <CardTitle>2. Cargar archivo</CardTitle>
          <CardDescription>
            Valida primero (no escribe nada) y luego carga a la base. El embalaje debe ser un Artículo tipo EMBALAJE
            existente y los componentes, Material de Embalaje o Servicio existentes.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <input
              ref={inputRef}
              type='file'
              accept='.xlsx'
              className='hidden'
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null)
                setResultado(null)
              }}
            />
            <Button variant='secondary' onClick={() => inputRef.current?.click()}>
              <Icons.upload className='mr-2 h-4 w-4' />
              Seleccionar archivo
            </Button>
            {archivo && <span className='text-muted-foreground text-sm'>{archivo.name}</span>}
          </div>

          <div className='flex flex-wrap gap-3'>
            <Button
              variant='outline'
              disabled={!archivo || procesarMut.isPending}
              onClick={() => procesarMut.mutate(false)}
            >
              {procesarMut.isPending && procesarMut.variables === false && (
                <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
              )}
              Validar (sin escribir)
            </Button>
            <Button
              disabled={!archivo || procesarMut.isPending || !puedeEscribir}
              onClick={() => procesarMut.mutate(true)}
              title={!puedeEscribir ? 'Requiere nivel TOTAL en Carga de Recetas' : undefined}
            >
              {procesarMut.isPending && procesarMut.variables === true && (
                <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
              )}
              Cargar a la base
            </Button>
            {resultado && resultado.errores.length > 0 && (
              <Button variant='ghost' onClick={() => reporteMut.mutate()} disabled={reporteMut.isPending}>
                <Icons.download className='mr-2 h-4 w-4' />
                Descargar reporte de errores
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              {resultado.dryRun ? 'Resultado de validación' : 'Resultado de la carga'}
              <Badge variant='secondary'>{recetasCreadas} recetas</Badge>
              <Badge variant={resultado.errores.length ? 'destructive' : 'secondary'}>
                {resultado.errores.length} errores
              </Badge>
            </CardTitle>
            {resultado.dryRun && (
              <CardDescription>Validación — no se escribió nada en la base.</CardDescription>
            )}
          </CardHeader>
          <CardContent className='flex flex-col gap-6'>
            {/* Resumen por hoja */}
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hoja</TableHead>
                    <TableHead className='text-right'>Filas</TableHead>
                    <TableHead className='text-right'>Creadas</TableHead>
                    <TableHead className='text-right'>Errores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(resultado.resumen).map(([hoja, r]) => {
                    const nErr = resultado.errores.filter((e) => e.hoja === hoja).length
                    return (
                      <TableRow key={hoja}>
                        <TableCell className='font-medium'>{hoja}</TableCell>
                        <TableCell className='text-right'>{r.filas}</TableCell>
                        <TableCell className='text-right'>{r.creados}</TableCell>
                        <TableCell className='text-right'>
                          {nErr > 0 ? <span className='text-destructive'>{nErr}</span> : nErr}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Detalle de errores */}
            {resultado.errores.length > 0 ? (
              <div className='max-h-96 overflow-auto rounded-md border'>
                <Table>
                  <TableHeader className='bg-muted sticky top-0'>
                    <TableRow>
                      <TableHead>Hoja</TableHead>
                      <TableHead>Fila</TableHead>
                      <TableHead>Columna</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Mensaje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.errores.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.hoja}</TableCell>
                        <TableCell>{e.fila || ''}</TableCell>
                        <TableCell>{e.columna ?? ''}</TableCell>
                        <TableCell>
                          <Badge variant='outline' className='text-xs'>
                            {e.codigo}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-sm'>{e.mensaje}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Alert>
                <Icons.check className='h-4 w-4' />
                <AlertTitle>Sin errores</AlertTitle>
                <AlertDescription>
                  {resultado.dryRun
                    ? 'El archivo está listo para cargar.'
                    : 'Todas las recetas se cargaron correctamente.'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
