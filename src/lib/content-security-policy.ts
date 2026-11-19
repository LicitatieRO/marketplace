import { MAP_TILE_HOST_ALLOWLIST } from "@/lib/map-tiles";

export const CSP_NONCE_HEADER = "x-nonce";

const STRIPE_CONNECT = "https://api.stripe.com";
const STRIPE_FRAME_HOSTS = [
  "https://js.stripe.com",
  "https://hooks.stripe.com",
  "https://checkout.stripe.com",
] as const;
const TOUR_FRAME_HOSTS = [
  "https://kuula.co",
  "https://www.kuula.co",
  "https://my.matterport.com",
] as const;
const APPROVED_IMAGE_HOSTS = [
  "https://images.unsplash.com",
  "https://images.pexels.com",
  "https://*.supabase.co",
] as const;

export function createContentSecurityPolicyNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function supabaseWebSocketOrigin(httpOrigin: string): string | null {
  try {
    const url = new URL(httpOrigin);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export type BuildContentSecurityPolicyInput = {
  nonce: string;
  isDev: boolean;
  /** When unset, falls back to `NEXT_PUBLIC_SUPABASE_URL` at build/runtime. */
  supabasePublicUrl?: string | null;
};

export function buildContentSecurityPolicy(
  input: BuildContentSecurityPolicyInput,
): string {
  const { nonce, isDev } = input;
  const imgSrc = [
    "'self'",
    "blob:",
    "data:",
    ...APPROVED_IMAGE_HOSTS,
    ...MAP_TILE_HOST_ALLOWLIST.map((host) => `https://${host}`),
  ];

  const connectSrc = ["'self'", STRIPE_CONNECT];
  const raw =
    input.supabasePublicUrl?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    "";
  if (raw) {
    try {
      const supabase = new URL(raw);
      connectSrc.push(supabase.origin);
      const ws = supabaseWebSocketOrigin(supabase.origin);
      if (ws) connectSrc.push(ws);
      if (supabase.protocol === "http:") {
        imgSrc.push(supabase.origin);
      }
    } catch {
      /* Ignore malformed env; connect-src stays same-origin + Stripe only. */
    }
  }

  const frameSrc = [...STRIPE_FRAME_HOSTS, ...TOUR_FRAME_HOSTS];

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src ${frameSrc.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
  ];

  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}
