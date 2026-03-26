export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 border-3 border-forest border-t-transparent rounded-full animate-spin" />
        <p className="text-sage text-sm font-body">Caricamento...</p>
      </div>
    </div>
  );
}
