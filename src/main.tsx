import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ConvexProvider } from 'convex/react';
import { convexReactClient } from './lib/convexClient.ts';

createRoot(document.getElementById('root')!).render(
  <ConvexProvider client={convexReactClient}>
    <App />
  </ConvexProvider>
);
