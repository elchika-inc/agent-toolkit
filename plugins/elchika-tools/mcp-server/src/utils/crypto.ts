export function atbash(text: string): string {
  return [...text]
    .map((c) => {
      if (c >= "A" && c <= "Z") return String.fromCharCode(90 - (c.charCodeAt(0) - 65));
      if (c >= "a" && c <= "z") return String.fromCharCode(122 - (c.charCodeAt(0) - 97));
      return c;
    })
    .join("");
}

export function caesarEncrypt(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return [...text]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + s) % 26) + 65);
      if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + s) % 26) + 97);
      return char;
    })
    .join("");
}
