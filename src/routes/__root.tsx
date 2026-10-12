import type { ReactNode } from 'react';
import { Link, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import { StudioLayout } from '../components/StudioLayout';
import '../index.css';
import '../components/workbench.css';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
       { name: 'theme-color', content: '#aaff00' },
    ],
    links: [
       { rel:'icon', type:'image/svg+xml', href: `${import.meta.env.BASE_URL}favicon.svg?v=activation-delta-3` },
       { rel:'apple-touch-icon', sizes:'180x180', href: `${import.meta.env.BASE_URL}apple-touch-icon.png?v=activation-delta-3` },
       { rel:'manifest', href: `${import.meta.env.BASE_URL}site.webmanifest?v=lime-chrome-1` },
    ],
  }),
  component: Root,
  notFoundComponent: () => <main className="not-found"><h1>Page not found</h1><p>This tool does not exist.</p><Link to="/">Return to the calculator studio</Link></main>,
});

function Root() {
  return (
    <RootDocument>
      <StudioLayout />
    </RootDocument>
  );
}

function RootDocument({children}: {children:ReactNode}) {
  return <html lang="en"><head><HeadContent/></head><body>{children}<Scripts/></body></html>;
}
