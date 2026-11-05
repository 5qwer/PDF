import { createFileRoute } from "@tanstack/react-router";
import App from "@/App";

// Catch-all route so wouter (inside App) can handle client-side navigation
// for /projects, /documents, /builder/:id, /questions, /page-designer, /settings, etc.
export const Route = createFileRoute("/$")({
  component: App,
});
