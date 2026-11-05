import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { ClientOnly } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/layout/Shell';

const Dashboard = lazy(() => import('@/pages/dashboard'));
const Projects = lazy(() => import('@/pages/projects'));
const Documents = lazy(() => import('@/pages/documents'));
const Builder = lazy(() => import('@/pages/builder'));
const Questions = lazy(() => import('@/pages/questions'));
const Settings = lazy(() => import('@/pages/settings'));
const PageDesigner = lazy(() => import('@/pages/page-designer'));
const Analyzer = lazy(() => import('@/pages/analyzer'));

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <ClientOnly fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
        <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/projects" component={Projects} />
            <Route path="/documents" component={Documents} />
            <Route path="/builder/:projectId" component={Builder} />
            <Route path="/questions" component={Questions} />
            <Route path="/settings" component={Settings} />
            <Route path="/page-designer" component={PageDesigner} />
            <Route path="/analyzer/:docId" component={Analyzer} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </ClientOnly>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;