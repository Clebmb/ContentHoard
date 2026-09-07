export default function Loading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-white/10" />
        <div className="absolute inset-0 rounded-full border-4 border-t-white animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-white/20 text-2xl">movie</span>
        </div>
      </div>
    </div>
  );
}
