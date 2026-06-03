export default function Loading() {
  return (
    <div className="flex-1 flex flex-col relative w-full min-h-screen items-center justify-center pt-32">
       <div className="relative w-24 h-24 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-white/5" />
        <div className="absolute inset-0 rounded-full border-4 border-t-white/30 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-white/10 text-5xl">movie</span>
        </div>
      </div>
      <div className="space-y-3 w-64">
        <div className="h-4 bg-white/5 rounded-full animate-pulse" />
        <div className="h-4 bg-white/5 rounded-full animate-pulse w-3/4 mx-auto" />
      </div>
    </div>
  );
}
