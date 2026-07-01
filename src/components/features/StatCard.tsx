import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Color = 'cyan' | 'violet' | 'emerald' | 'amber' | 'red';

const colorMap: Record<Color, { ring: string; iconBg: string; icon: string; value: string }> = {
  cyan:    { ring: 'border-cyan-400/20',    iconBg: 'bg-cyan-400/10',    icon: 'text-cyan-400',    value: 'text-cyan-300'    },
  violet:  { ring: 'border-violet-400/20',  iconBg: 'bg-violet-400/10',  icon: 'text-violet-400',  value: 'text-violet-300'  },
  emerald: { ring: 'border-emerald-400/20', iconBg: 'bg-emerald-400/10', icon: 'text-emerald-400', value: 'text-emerald-300' },
  amber:   { ring: 'border-amber-400/20',   iconBg: 'bg-amber-400/10',   icon: 'text-amber-400',   value: 'text-amber-300'   },
  red:     { ring: 'border-red-400/20',     iconBg: 'bg-red-400/10',     icon: 'text-red-400',     value: 'text-red-300'     },
};

interface Props {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: Color;
  description?: string;
  badge?: string;
}

export default function StatCard({ label, value, icon: Icon, color, description, badge }: Props) {
  const c = colorMap[color];
  return (
    <div className={cn('bg-card border rounded-lg p-4 flex flex-col gap-3', c.ring)}>
      <div className="flex items-start justify-between">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', c.iconBg)}>
          <Icon className={cn('w-4 h-4', c.icon)} />
        </div>
        {badge && (
          <span className="text-[10px] font-mono bg-red-400/10 text-red-400 px-1.5 py-0.5 rounded border border-red-400/20">
            {badge}
          </span>
        )}
      </div>
      <div>
        <div className={cn('text-2xl font-bold font-mono tracking-tight', c.value)}>
          {value}
        </div>
        <div className="text-xs font-medium text-foreground mt-0.5">{label}</div>
        {description && (
          <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">{description}</div>
        )}
      </div>
    </div>
  );
}
