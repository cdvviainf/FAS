'use client';

import { useMemo } from 'react';
import type { NavItem, NavGroup } from '@/types';
import {
  useMenuAcceso,
  resolverNivelPorRuta,
  type ItemMenuAcceso,
} from '@/contexts/menu-acceso-context';

// Oculta un ítem del sidebar/buscador solo cuando su ruta resuelve
// explícitamente a SIN_ACCESO. Sin match (catálogo ItemMenu incompleto) o
// con LECTURA/TOTAL, el ítem se mantiene visible (ver Docs — comportamiento
// por defecto mientras se completa el catálogo).
function filtrarItem(item: NavItem, accesoItems: ItemMenuAcceso[]): NavItem | null {
  if (item.items && item.items.length > 0) {
    const subItems = item.items
      .map((sub) => filtrarItem(sub, accesoItems))
      .filter((i): i is NavItem => i !== null);
    if (subItems.length === 0) return null;
    return { ...item, items: subItems };
  }

  if (item.url === '#') return item;
  const nivel = resolverNivelPorRuta(item.url, accesoItems);
  return nivel === 'SIN_ACCESO' ? null : item;
}

export function useFilteredNavItems(items: NavItem[]) {
  const { items: accesoItems, isLoading } = useMenuAcceso();
  return useMemo(() => {
    if (isLoading) return items;
    return items
      .map((item) => filtrarItem(item, accesoItems))
      .filter((item): item is NavItem => item !== null);
  }, [items, accesoItems, isLoading]);
}

export function useFilteredNavGroups(groups: NavGroup[]) {
  const { items: accesoItems, isLoading } = useMenuAcceso();
  return useMemo(() => {
    if (isLoading) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items
          .map((item) => filtrarItem(item, accesoItems))
          .filter((item): item is NavItem => item !== null),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, accesoItems, isLoading]);
}
