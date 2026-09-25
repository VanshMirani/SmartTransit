import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { CommunicationsProvider } from "./communications/CommunicationsContext";
import { SystemSettingsProvider } from "./settings/SystemSettingsContext";
import { PageLoadBoundary } from './components/DeferredPage';
import { AccountScope } from './auth/AccountScope';
import { NavigationEffects } from './components/NavigationEffects';
import "./styles.css";
createRoot(document.getElementById("root")).render(<StrictMode>
  <PageLoadBoundary>
    <BrowserRouter>
      <NavigationEffects />
      <AuthProvider>
        <AccountScope>
        <CommunicationsProvider>
          <SystemSettingsProvider>
            <App />
          </SystemSettingsProvider>
        </CommunicationsProvider>
        </AccountScope>
      </AuthProvider>
    </BrowserRouter>
  </PageLoadBoundary>
  </StrictMode>);
