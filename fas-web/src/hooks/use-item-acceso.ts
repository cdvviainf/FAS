'use client';

import { MOCK_ACCESOS, type NivelAcceso } from '@/lib/mock-session';

/**
 * Retorna el nivel de acceso del usuario actual para un ítem de menú.
 * En producción: consultar el contexto de sesión cargado desde /api/config/me/menu.
 */
export function useItemAcceso(itemMenu: string): NivelAcceso {
  return MOCK_ACCESOS[itemMenu] ?? 'SIN_ACCESO';
}

export function usePuedeEscribir(itemMenu: string): boolean {
  return useItemAcceso(itemMenu) === 'TOTAL';
}

export function usePuedeLeer(itemMenu: string): boolean {
  const nivel = useItemAcceso(itemMenu);
  return nivel === 'LECTURA' || nivel === 'TOTAL';
}
