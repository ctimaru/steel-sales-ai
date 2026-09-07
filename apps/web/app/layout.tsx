import type { ReactNode } from 'react';

export const metadata = {
  title: 'Steel Sales AI',
  description: 'Commercial intelligence for steel sales',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
