import { Link } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <div className="text-6xl font-mono font-bold text-muted-foreground/20">404</div>
      <div className="text-sm font-semibold text-foreground">Page not found</div>
      <div className="text-xs text-muted-foreground font-mono">This route does not exist in the gateway.</div>
      <Link
        to="/"
        className="flex items-center gap-2 mt-2 px-4 py-2 bg-primary/10 border border-primary/25 text-primary text-sm rounded-lg hover:bg-primary/20 transition-colors"
      >
        <LayoutDashboard className="w-4 h-4" />
        Back to Dashboard
      </Link>
    </div>
  );
}
