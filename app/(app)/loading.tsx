export default function Loading() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-muted">
      <div className="h-full w-1/2 animate-pulse bg-primary" />
    </div>
  );
}
