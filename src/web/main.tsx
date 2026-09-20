import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LangProvider } from "./i18n";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_PATH || "/"}>
      <LangProvider>
        <App />
      </LangProvider>
    </BrowserRouter>
  </React.StrictMode>
);
