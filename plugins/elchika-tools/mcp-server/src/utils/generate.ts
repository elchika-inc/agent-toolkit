export function generateUUIDv4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateULID(): string {
  const now = Date.now();
  let timestamp = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    timestamp = (CROCKFORD[t % 32] ?? "0") + timestamp;
    t = Math.floor(t / 32);
  }
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  let random = "";
  let bits = 0,
    val = 0,
    ri = 0;
  for (let i = 0; i < 16; i++) {
    while (bits < 5 && ri < randomBytes.length) {
      val = (val << 8) | (randomBytes[ri++] ?? 0);
      bits += 8;
    }
    bits -= 5;
    random += CROCKFORD[(val >> bits) & 0x1f] ?? "0";
  }
  return timestamp + random;
}
