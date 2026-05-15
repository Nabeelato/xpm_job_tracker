export default function Loading() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-primary/20">
      <div
        className="h-full w-1/4 bg-primary"
        style={{ animation: "nav-sweep 1.1s ease-in-out infinite" }}
      />
    </div>
  );
}
