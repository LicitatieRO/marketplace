const URL_IN_TEXT =
  /https?:\/\/[^\s<>"']+/gi;

const PERCENT_ENCODED_VERIFY_URL =
  /https%3a%2f%2f[^\s<>"']+%2fauth%2fv1%2fverify[^\s<>"']*/gi;

export function maskUrlForDisplay(raw: string): string {
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    const q = raw.indexOf("?");
    return q >= 0 ? raw.slice(0, q) : raw;
  }
}

function maskEncodedActionLink(match: string): string {
  try {
    const decoded = decodeURIComponent(match);
    if (/\/auth\/v1\/verify\b/i.test(decoded)) {
      return maskUrlForDisplay(decoded);
    }
  } catch {
  // Fall through to query stripping when decoding fails.
  }
  const query = match.search(/%3[fF]/);
  return query >= 0 ? match.slice(0, query) : "[action link redacted]";
}

export function maskActionLinksInText(text: string): string {
  const withEncoded = text.replace(PERCENT_ENCODED_VERIFY_URL, (match) =>
    maskEncodedActionLink(match),
  );
  return withEncoded.replace(URL_IN_TEXT, (match) => maskUrlForDisplay(match));
}

const TOKEN_HASH_CALLBACK_LINK =
  /\/auth\/callback\b[^\s<>"']*token_hash=/i;

export function textContainsMaskedActionLink(text: string): boolean {
  return /\/auth\/v1\/verify\b/i.test(text) || TOKEN_HASH_CALLBACK_LINK.test(text);
}
