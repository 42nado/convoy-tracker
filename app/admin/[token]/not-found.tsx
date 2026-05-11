export default function NotFound() {
  return (
    <section className="space-y-3 py-10 text-center">
      <h1 className="text-2xl font-bold">Creator link not valid</h1>
      <p className="text-sm text-slate-600">
        This creator link doesn't match any convoy. Double-check the URL.
      </p>
      <a href="/" className="btn-secondary inline-flex">
        Start a new convoy
      </a>
    </section>
  );
}
