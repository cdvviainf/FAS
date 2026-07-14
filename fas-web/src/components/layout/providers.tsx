'use client';
import React from 'react';
import { ActiveThemeProvider } from '../themes/active-theme';
import QueryProvider from './query-provider';
import { TemporadaProvider } from '@/contexts/temporada-context';

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
        <TemporadaProvider>
          {children}
        </TemporadaProvider>
      </QueryProvider>
    </ActiveThemeProvider>
  );
}
