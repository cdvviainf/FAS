'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { api } from '@/lib/api'
import { useMenuAcceso, type ItemMenuAcceso } from '@/contexts/menu-acceso-context'

// Resuelve el ItemMenu más específico (ruta más larga que matchea) para una
// ruta — misma lógica que resolverNivelPorRuta, pero retorna el código del ítem
// (o null si ninguno lo cubre, p. ej. sub-rutas /nueva, /[id]).
function resolverItemCodigo(pathname: string, items: ItemMenuAcceso[]): string | null {
  let mejor: ItemMenuAcceso | null = null
  for (const item of items) {
    if (item.esAccion || !item.ruta || item.ruta === '/dashboard') continue
    const coincide = pathname === item.ruta || pathname.startsWith(`${item.ruta}/`)
    if (!coincide) continue
    if (!mejor || item.ruta.length > (mejor.ruta as string).length) mejor = item
  }
  return mejor?.codigo ?? null
}

// Emite un evento ACCESO_MENU (POST /api/auditoria/navegacion) en cada cambio de
// ruta dentro del dashboard. Fire-and-forget: no bloquea la navegación ni
// muestra errores (la auditoría de navegación es best-effort). Se monta una sola
// vez en el layout protegido.
export function NavegacionAuditoria() {
  const pathname = usePathname()
  const { items, isLoading } = useMenuAcceso()
  const ultimaRuta = useRef<string | null>(null)

  useEffect(() => {
    // Sin accesos cargados (sesión aún no resuelta) no se registra: el backend
    // tomaría usuario/empresa del contexto y quedaría incompleto.
    if (isLoading || !pathname || items.length === 0) return
    if (ultimaRuta.current === pathname) return
    ultimaRuta.current = pathname

    const itemMenuCodigo = resolverItemCodigo(pathname, items)
    void api
      .post('auditoria/navegacion', { json: { ruta: pathname, itemMenuCodigo } })
      .catch(() => {
        // best-effort: si falla el registro, no afecta la navegación.
      })
  }, [pathname, items, isLoading])

  return null
}
