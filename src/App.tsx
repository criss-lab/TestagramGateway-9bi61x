import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import Dashboard from '@/pages/Dashboard';
import Instances from '@/pages/Instances';
import ImportFeed from '@/pages/ImportFeed';
import ExportQueue from '@/pages/ExportQueue';
import SyncStatus from '@/pages/SyncStatus';
import FeedTimeline from '@/pages/FeedTimeline';
import PayloadInspector from '@/pages/PayloadInspector';
import DeliveryAnalytics from '@/pages/DeliveryAnalytics';
import XCloneFeed from '@/pages/XCloneFeed';
import BlockedInstances from '@/pages/BlockedInstances';
import APSchema from '@/pages/APSchema';
import ActivityStream from '@/pages/ActivityStream';
import HttpSigDebugger from '@/pages/HttpSigDebugger';
import KeyManagement from '@/pages/KeyManagement';
import NodeInfoBrowser from '@/pages/NodeInfoBrowser';
import DeliverWorker from '@/pages/DeliverWorker';
import NotFound from '@/pages/NotFound';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchInterval: 30_000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
  },
});

function AppInner() {
  useAutoRefresh(90_000);

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/instances" element={<Instances />} />
              <Route path="/import" element={<ImportFeed />} />
              <Route path="/export" element={<ExportQueue />} />
              <Route path="/sync" element={<SyncStatus />} />
              <Route path="/timeline" element={<FeedTimeline />} />
              <Route path="/xclone" element={<XCloneFeed />} />
              <Route path="/inspector" element={<PayloadInspector />} />
              <Route path="/analytics" element={<DeliveryAnalytics />} />
              <Route path="/blocked" element={<BlockedInstances />} />
              <Route path="/schema" element={<APSchema />} />
              {/* New pages */}
              <Route path="/activities" element={<ActivityStream />} />
              <Route path="/http-sig" element={<HttpSigDebugger />} />
              <Route path="/keys" element={<KeyManagement />} />
              <Route path="/nodeinfo" element={<NodeInfoBrowser />} />
              <Route path="/deliver" element={<DeliverWorker />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
      <Toaster theme="dark" position="bottom-right" />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
