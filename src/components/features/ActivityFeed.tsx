import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils';
import type { ActivityLog } from '@/types/federation';

interface Props {
  logs: ActivityLog[];
  maxHeight?: string;
}

const moduleColors: Record<string, string> = {
  import:  'text-violet-400 bg-violet-400/8 border-violet-400/20',
  export:  'text-emerald-400 bg-emerald-400/8 border-emerald-400/20',
  sync:    'text-cyan-400 bg-cyan-400/8 border-cyan-400/20',
  routes:  'text-amber-400 bg-amber-400/8 border-amber-400/20',
};

const statusDot: Record<string, string> = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error:   'bg-red-400',
};

export default function ActivityFeed({ logs, maxHeight = 'max-h-80' }: Props) {
  if (!logs.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-4 py-8 text-center text-sm text-muted-foreground font-mono">
        No activity logged yet.
      </div>
    );
  }

  return (
    <div className={cn('bg-card border border-border rounded-lg overflow-y-auto divide-y divide-border', maxHeight)}>
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
          {/* Status dot */}
          <div className="flex-shrink-0 mt-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', statusDot[log.status] ?? 'bg-muted-foreground')} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border capitalize', moduleColors[log.module] ?? 'text-muted-foreground bg-muted border-border')}>
                {log.module}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/60">{log.event_type}</span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground/50 flex-shrink-0">
                {timeAgo(log.created_at)}
              </span>
            </div>
            {log.description && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{log.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
