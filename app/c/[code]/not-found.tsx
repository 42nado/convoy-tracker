export default function NotFound() {
  return (
    <section className="space-y-3 py-10 text-center">
      <h1 className="text-2xl font-bold">Convoy not found</h1>
      <p className="text-sm text-slate-600">
        The link might be wrong or the convoy was deleted.
      </p>
      <a href="/" className="btn-secondary inline-flex">
        Start a new convoy
      </a>
    </section>
  );
}
