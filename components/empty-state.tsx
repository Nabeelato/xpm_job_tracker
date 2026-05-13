export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border bg-white p-8 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
