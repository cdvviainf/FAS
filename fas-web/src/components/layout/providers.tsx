'use client';
import React from 'react';
import { ActiveThemeProvider } from '../themes/active-theme';
import QueryProvider from './query-provider';
import { TemporadaProvider } from '@/contexts/temporada-context';
import { MenuAccesoProvider } from '@/contexts/menu-acceso-context';

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <ActiveThemeProvider initialTheme={activeThemeValue}>
      <QueryProvider>
        <MenuAccesoProvider>
          <TemporadaProvider>
            {children}
          </TemporadaProvider>
        </MenuAccesoProvider>
      </QueryProvider>
    </ActiveThemeProvider>
  );
}
