'use client';
import { navGroups } from '@/config/nav-config';
import { KBarAnimator, KBarPortal, KBarPositioner, KBarProvider, KBarSearch, useRegisterActions } from 'kbar';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import RenderResults from './render-result';
import useThemeSwitching from './use-theme-switching';
import { useFilteredNavGroups } from '@/hooks/use-nav';

export default function KBar({ children }: { children: React.ReactNode }) {
  return (
    <KBarProvider>
      <KBarComponent>{children}</KBarComponent>
    </KBarProvider>
  );
}
const KBarComponent = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const filteredGroups = useFilteredNavGroups(navGroups);

  // Acciones de navegación del buscador. Se registran DINÁMICAMENTE con
  // useRegisterActions (abajo) y no vía KBarProvider actions={}, porque los
  // permisos del menú cargan async: al montar, useFilteredNavGroups devuelve []
  // (fail-closed, QA-MENU-002) y un actions estático quedaría vacío para siempre.
  const actions = useMemo(() => {
    const navigateTo = (url: string) => {
      router.push(url);
    };

    const allItems = filteredGroups.flatMap((group) => group.items);

    return allItems.flatMap((navItem) => {
      const baseAction =
        navItem.url !== '#'
          ? {
              id: `${navItem.title.toLowerCase()}Action`,
              name: navItem.title,
              shortcut: navItem.shortcut,
              keywords: navItem.title.toLowerCase(),
              section: 'Navegación',
              subtitle: `Ir a ${navItem.title}`,
              perform: () => navigateTo(navItem.url)
            }
          : null;

      const childActions =
        navItem.items?.map((childItem) => ({
          id: `${childItem.title.toLowerCase()}Action`,
          name: childItem.title,
          shortcut: childItem.shortcut,
          keywords: childItem.title.toLowerCase(),
          section: navItem.title,
          subtitle: `Ir a ${childItem.title}`,
          perform: () => navigateTo(childItem.url)
        })) ?? [];

      return baseAction ? [baseAction, ...childActions] : childActions;
    });
  }, [router, filteredGroups]);

  // Registro dinámico: cuando los permisos resuelven y `actions` cambia, kbar
  // reemplaza las acciones de navegación (igual que useThemeSwitching).
  useRegisterActions(actions, [actions]);
  useThemeSwitching();

  return (
    <>
      <KBarPortal>
        <KBarPositioner className='bg-background/80 fixed inset-0 z-99999 p-0! backdrop-blur-sm'>
          <KBarAnimator className='bg-card text-card-foreground relative mt-64! w-full max-w-[600px] -translate-y-12! overflow-hidden rounded-lg border shadow-lg'>
            <div className='bg-card border-border sticky top-0 z-10 border-b'>
              <KBarSearch className='bg-card w-full border-none px-6 py-4 text-lg outline-hidden focus:ring-0 focus:ring-offset-0 focus:outline-hidden' />
            </div>
            <div className='max-h-[400px]'>
              <RenderResults />
            </div>
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      {children}
    </>
  );
};
