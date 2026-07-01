import { useLocation } from 'react-router-dom';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const pageMeta: Record<string, { title: string; description: string }> = {
  '/':          { title: 'Dashboard',           description: 'Federation overview and system health' },
  '/instances': { title: 'Instances',           description: 'Connected Fediverse servers — testagram.site' },
  '/import':    { title: 'Import Feed',         description: 'Remote accounts and fetched posts' },
  '/export':    { title: 'Export Queue',        description: 'Outbound ActivityPub delivery' },
  '/sync':      { title: 'Sync Status',         description: 'Follow and profile synchronization' },
  '/timeline':  { title: 'Feed Timeline',       description: 'Unified Fediverse post timeline with interactions' },
  '/xclone':    { title: 'XClone Feed',         description: 'Twitter-style federated feed powered by ActivityPub' },
  '/inspector': { title: 'AP Inspector',        description: 'ActivityPub payload inspector, builder & WebFinger resolver' },
  '/analytics': { title: 'Delivery Analytics',  description: 'Delivery metrics, charts and module activity' },
};

export default function TopBar() {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const page = pageMeta[pathname] ?? { title: 'Not Found', description: '' };
  const [connected, setConnected] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    async function check() {
      try {
        const { error } = await supabase.from('federation_instances').select('id').limit(1);
        setConnected(!error);
      } catch {
        setConnected(false);
      }
    }
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    toast.success('All data refreshed.');
    setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur-sm flex items-center px-6 gap-4 flex-shrink-0">
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-foreground">{page.title}</h1>
        <p className="text-xs text-muted-foreground truncate">{page.description}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {connected !== null && (
          <div className={`hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded border ${
            connected ? 'text-emerald-400 bg-emerald-400/8 border-emerald-400/20' : 'text-red-400 bg-red-400/8 border-red-400/20'
          }`}>
            {connected ? <><Wifi className="w-3 h-3" /><span>testagram.site</span></> : <><WifiOff className="w-3 h-3" /><span>Offline</span></>}
          </div>
        )}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono bg-muted/60 px-2.5 py-1 rounded border border-border">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>auto-sync</span>
        </div>
        <div className="hidden lg:block text-[11px] text-muted-foreground font-mono bg-muted/60 px-2.5 py-1 rounded border border-border">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <button onClick={handleRefresh}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded border border-border hover:border-primary/30 hover:bg-muted/60">
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
}
