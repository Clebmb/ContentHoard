"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Loading from "@/app/loading";

export function NavigationLoader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // Show loader on any URL change
    setIsNavigating(true);
    // 400ms is the "sweet spot" for providing the transition illusion
    const timer = setTimeout(() => setIsNavigating(false), 400);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  return isNavigating ? (
    <div className="flex-1 flex flex-col pt-32 min-h-[70vh] items-center justify-center">
        <Loading />
    </div>
  ) : children;
}
