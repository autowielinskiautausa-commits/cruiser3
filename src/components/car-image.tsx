import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/storage";
import { Car } from "lucide-react";

export function CarImage({ path, alt, className }: { path?: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    let active = true;
    if (path) getSignedUrl(path).then((u) => active && setUrl(u));
    else setUrl("");
    return () => { active = false; };
  }, [path]);

  if (!path) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className ?? ""}`}>
        <Car className="w-12 h-12 text-muted-foreground/40" />
      </div>
    );
  }
  if (!url) return <div className={`bg-muted animate-pulse ${className ?? ""}`} />;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
