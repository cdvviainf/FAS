'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { GrupoDefectoFormSheet } from './grupo-defecto-form-sheet'
import { grupoDefectoExtraColumns } from './grupo-defecto-columns'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface GrupoDefectoItem extends MantenedorSimple {
  tipoDefectoId?: number
  tipoDefecto?: { id: number; descripcion: string }
}

export function GrupoDefectoListingClient() {
  return (
    <MantenedorListing
      recurso='grupos-defecto'
      titulo='Grupo de Defecto'
      extraColumns={grupoDefectoExtraColumns}
      renderEditSheet={({ item, open, onOpenChange }) => (
        <GrupoDefectoFormSheet
          item={item as unknown as GrupoDefectoItem}
          open={open}
          onOpenChange={onOpenChange}
        />
      )}
    />
  )
}
