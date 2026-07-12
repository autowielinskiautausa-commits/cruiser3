import { useState } from "react";
import { CarImage } from "@/components/car-image";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Image carousel with prev/next arrows.
 * - Works with touch: arrows are real buttons with generous tap targets.
 * - `stopNav` prevents the arrow tap from triggering a parent <Link> (used on tiles).
 */
export function CarCarousel({
  images,
  alt,
  className,
  imgClassName,
  arrowSize = "sm",
  stopNav = false,
}: {
  images?: string[];
  alt: string;
  className?: string;
  imgClassName?: string;
  arrowSize?: "sm" | "lg";
  stopNav?: boolean;
}) {
  const list = images ?? [];
  const [active, setActive] = useState(0);
  const count = list.length;
  const current = count > 0 ? Math.min(active, count - 1) : 0;

  function go(delta: number, e: React.MouseEvent) {
    if (stopNav) {
      e.preventDefault();
      e.stopPropagation();
    }
    setActive((prev) => {
      const base = Math.min(prev, count - 1);
      return (base + delta + count) % count;
    });
  }

  const btnBase =
    "absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-full bg-background/70 text-foreground backdrop-blur-sm shadow-md transition-opacity hover:bg-background/90 active:bg-background touch-manipulation";
  const btnSize = arrowSize === "lg" ? "w-10 h-10" : "w-8 h-8";
  const iconSize = arrowSize === "lg" ? "w-6 h-6" : "w-5 h-5";

  return (
    <div className={`relative ${className ?? ""}`}>
      <CarImage path={list[current]} alt={alt} className={imgClassName} />

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Poprzednie zdjęcie"
            onClick={(e) => go(-1, e)}
            className={`${btnBase} ${btnSize} left-2`}
          >
            <ChevronLeft className={iconSize} />
          </button>
          <button
            type="button"
            aria-label="Następne zdjęcie"
            onClick={(e) => go(1, e)}
            className={`${btnBase} ${btnSize} right-2`}
          >
            <ChevronRight className={iconSize} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
            {list.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? "w-4 bg-background" : "w-1.5 bg-background/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
