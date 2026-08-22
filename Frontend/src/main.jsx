import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { CommunicationsProvider } from "./communications/CommunicationsContext";
import { SystemSettingsProvider } from "./settings/SystemSettingsContext";
import "./styles.css";
createRoot(document.getElementById("root")).render(<StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CommunicationsProvider>
          <SystemSettingsProvider>
            <App />
          </SystemSettingsProvider>
        </CommunicationsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>);
