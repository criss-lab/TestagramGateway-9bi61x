import { cn } from '@/lib/utils';

type StatusKey =
  | 'active' | 'unreachable' | 'suspended'
  | 'delivered' | 'pending' | 'failed' | 'retrying'
  | 'success' | 'warning' | 'error'
  | 'accepted' | 'rejected';

const config: Record<StatusKey, { bg: string; text: string; dot: string }> = {
  active:      { bg: 'bg-emerald-400/12', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  delivered:   { bg: 'bg-emerald-400/12', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  success:     { bg: 'bg-emerald-400/12', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  accepted:    { bg: 'bg-emerald-400/12', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  pending:     { bg: 'bg-sky-400/12',     text: 'text-sky-400',     dot: 'bg-sky-400'     },
  unreachable: { bg: 'bg-amber-400/12',   text: 'text-amber-400',   dot: 'bg-amber-400'   },
  retrying:    { bg: 'bg-amber-400/12',   text: 'text-amber-400',   dot: 'bg-amber-400'   },
  warning:     { bg: 'bg-amber-400/12',   text: 'text-amber-400',   dot: 'bg-amber-400'   },
  failed:      { bg: 'bg-red-400/12',     text: 'text-red-400',     dot: 'bg-red-400'     },
  suspended:   { bg: 'bg-red-400/12',     text: 'text-red-400',     dot: 'bg-red-400'     },
  error:       { bg: 'bg-red-400/12',     text: 'text-red-400',     dot: 'bg-red-400'     },
  rejected:    { bg: 'bg-red-400/12',     text: 'text-red-400',     dot: 'bg-red-400'     },
};

interface Props {
  status: string;
  pulse?: boolean;
}

export default function StatusBadge({ status, pulse }: Props) {
  const s = config[status as StatusKey] ?? config.pending;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-transparent', s.bg, s.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot, pulse && 'animate-pulse')} />
      {status}
    </span>
  );
}
