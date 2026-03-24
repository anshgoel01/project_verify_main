// import { createRoot } from "react-dom/client";
// import App from "./App.tsx";
// import "./index.css";

// createRoot(document.getElementById("root")!).render(<App />);


import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Clear stale JWT tokens from old Supabase project on app load
const currentProjectRef = import.meta.env.VITE_SUPABASE_URL?.split(".")?.[0]?.split("//")?.[1];
if (currentProjectRef) {
    Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sb-") && key.endsWith("-auth-token") && !key.includes(currentProjectRef)) {
            localStorage.removeItem(key);
        }
    });
}

createRoot(document.getElementById("root")!).render(<App />);