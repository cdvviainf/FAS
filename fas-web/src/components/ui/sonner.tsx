'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className='toaster group'
      richColors
      closeButton
      duration={4500}
      position='top-right'
      toastOptions={{
        classNames: {
          error: 'font-medium',
          success: 'font-medium',
          warning: 'font-medium',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
