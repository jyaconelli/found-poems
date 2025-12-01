export function randomHex() {
  return crypto
    .getRandomValues(new Uint8Array(8))
    .reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
}
