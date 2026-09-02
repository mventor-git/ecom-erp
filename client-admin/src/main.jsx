import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initTheme } from './utils/theme';
import { LanguageProvider } from './i18n';
import { installClickSounds } from './utils/sounds';
import { installHeat } from './utils/fx';
import CoffeeSplash from './admin/components/CoffeeSplash';
import { useState as _st } from 'react';
import './utils/fx.css';
import './index.css';

// Apply saved (or system) theme before first paint — avoids a light flash
initTheme();
// Soft synthesized click/nav/toggle sounds across the admin panel
installClickSounds();
installHeat();

function Boot() {
  const [booting, setBooting] = _st(true);
  return (
    <>
      {booting && <CoffeeSplash label="Preparing your coffee" duration={1400} onFinish={() => setBooting(false)} />}
      {!booting && (
        <React.StrictMode>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <LanguageProvider>
              <App />
            </LanguageProvider>
          </BrowserRouter>
        </React.StrictMode>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Boot />);
