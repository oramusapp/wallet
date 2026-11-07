import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { NavProvider } from './state/nav';
import { PricesProvider } from './state/prices';
import { WalletProvider } from './state/wallet';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PricesProvider>
      <WalletProvider>
        <NavProvider>
          <App />
        </NavProvider>
      </WalletProvider>
    </PricesProvider>
  </StrictMode>,
);
