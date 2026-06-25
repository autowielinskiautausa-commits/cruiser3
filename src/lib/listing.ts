export const LEGAL_DISCLAIMER =
  "Niniejsze ogłoszenie stanowi zaproszenie do negocjacji w rozumieniu art. 71 Kodeksu cywilnego i nie stanowi oferty w rozumieniu art. 66 § 1 Kodeksu cywilnego.";

export const FUEL_OPTIONS = [
  "Benzyna",
  "Diesel",
  "Hybryda",
  "Hybryda plug-in",
  "Elektryczny",
  "LPG",
];

export const TRANSMISSION_OPTIONS = ["Manualna", "Automatyczna"];

const YOUTUBE_HOSTS = ["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"];

// Safely classify a video URL by parsing its hostname (never substring matching).
// Returns an embeddable iframe src for trusted YouTube hosts, a direct file URL for
// our own Supabase storage origin, or null when the URL is untrusted/malformed.
export function resolveVideo(rawUrl: string): { kind: "youtube" | "file"; src: string } | null {
  if (!rawUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const host = parsed.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.includes(host)) {
    let id = "";
    if (host === "youtu.be") {
      id = parsed.pathname.slice(1);
    } else if (parsed.pathname.startsWith("/embed/")) {
      id = parsed.pathname.split("/embed/")[1] ?? "";
    } else {
      id = parsed.searchParams.get("v") ?? "";
    }
    id = id.split("/")[0];
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
    return { kind: "youtube", src: `https://www.youtube.com/embed/${id}` };
  }

  // Only allow direct video files served from our own Supabase storage origin.
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (supabaseUrl) {
    try {
      if (host === new URL(supabaseUrl).hostname.toLowerCase()) {
        return { kind: "file", src: parsed.toString() };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

// Used at form save time to reject obviously untrusted video URLs entered by editors.
export function isAllowedVideoInput(rawUrl: string): boolean {
  if (!rawUrl) return true; // empty is fine
  return resolveVideo(rawUrl) !== null;
}
