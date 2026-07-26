'use client';

import { useMenuAcceso, type NivelAcceso } from '@/contexts/menu-acceso-context';

/**
 * Retorna el nivel de acceso del usuario actual para un ítem de menú,
 * según el perfil real de la sesión (GET /api/config/me/menu).
 */
export function useItemAcceso(itemMenu: string): NivelAcceso {
  const { accesos } = useMenuAcceso();
  return accesos.get(itemMenu) ?? 'SIN_ACCESO';
}

export function usePuedeEscribir(itemMenu: string): boolean {
  return useItemAcceso(itemMenu) === 'TOTAL';
}

export function usePuedeLeer(itemMenu: string): boolean {
  const nivel = useItemAcceso(itemMenu);
  return nivel === 'LECTURA' || nivel === 'TOTAL';
}
