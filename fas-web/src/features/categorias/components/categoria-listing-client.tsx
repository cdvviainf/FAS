'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { CategoriaFormSheet } from './categoria-form-sheet'
import { categoriaExtraColumns } from './categoria-columns'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface CategoriaItem extends MantenedorSimple {
  especieId?: number
  orden?: number
  control?: string[]
  especie?: { id: number; descripcion: string }
}

export function CategoriaListingClient() {
  return (
    <MantenedorListing
      recurso='categorias'
      titulo='Categoría'
      extraColumns={categoriaExtraColumns}
      renderEditSheet={({ item, open, onOpenChange }) => (
        <CategoriaFormSheet
          item={item as unknown as CategoriaItem}
          open={open}
          onOpenChange={onOpenChange}
        />
      )}
    />
  )
}
