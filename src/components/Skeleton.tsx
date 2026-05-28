import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton", className)} />;
}

/* ── Pre-built skeleton patterns ── */

export function SkeletonCard() {
  return (
    <div className="card rounded-[14px] p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function SkeletonListItem() {
  return (
    <div className="card rounded-[14px] p-4 flex items-center gap-4">
      <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="card rounded-[18px] p-6 space-y-6">
      <div className="flex justify-between items-end h-40 gap-2">
        {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-end justify-end h-full">
            <Skeleton className="w-full rounded-t-md" style={{ height: `${h}%` }} />
          </div>
        ))}
      </div>
      <div className="pt-4 border-t border-dashed border-gray-100 flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>
        <Skeleton className="h-4 w-24 self-end" />
      </div>
    </div>
  );
}
