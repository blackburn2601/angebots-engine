export default function Loading() {
  return (
    <div className="flex h-full min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="loading-ring" />
        <p className="text-xs text-muted-foreground tracking-wide">Laden …</p>
      </div>
    </div>
  );
}
