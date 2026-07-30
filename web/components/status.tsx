export function LoadingState({ label = "Loading simulations…" }: { label?: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-slate-400">{label}</div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      <p className="font-medium">Couldn&apos;t load simulation data</p>
      <p className="text-red-600 dark:text-red-400">{message}</p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400 dark:border-slate-700">
      {message}
    </div>
  );
}
