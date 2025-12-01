export function tokenizeSource(body: string) {
  return body
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}
