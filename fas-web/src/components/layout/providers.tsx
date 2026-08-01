'use client';
import React from 'react';
import { ActiveThemeProvider } from '../themes/active-theme';
import QueryProvider from './query-provider';
import { TemporadaProvider } from '@/contexts/temporada-context';
import { MenuAccesoProvider } from '@/contexts/menu-acceso-context';
import { EmpresaProvider } from '@/contexts/empresa-context';

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
        <EmpresaProvider>
          <MenuAccesoProvider>
            <TemporadaProvider>
              {children}
            </TemporadaProvider>
          </MenuAccesoProvider>
        </EmpresaProvider>
      </QueryProvider>
    </ActiveThemeProvider>
  );
}
