import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ConvexProvider } from 'convex/react';
import { convexReactClient } from './lib/convexClient.ts';
import { registerSW } from 'virtual:pwa-register';

// Inicialización controlada del Service Worker de la PWA
registerSW({
  immediate: true,
  onNeedRefresh() {
    // Actualización automática sin romper navegación activa
  },
  onOfflineReady() {
    // Contenido estático precacheado y listo
  },
});

createRoot(document.getElementById('root')!).render(
  <ConvexProvider client={convexReactClient}>
    <App />
  </ConvexProvider>
);
