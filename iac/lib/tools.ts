import * as fs from 'fs';
import sha256 from 'fast-sha256';

export function calculateSha256(path: string): string {
  const buffer: Buffer = fs.readFileSync(path, {flag: 'r'})
  return toHexString(sha256(buffer));
}

export function toHexString(byteArray: Uint8Array): string {
  const strBytes: string[] = [];
  byteArray.forEach(byte => {
    strBytes.push(('0' + (byte & 0xFF).toString(16)).slice(-2));
  });
  return strBytes.join('');
}

export function rstripslash(s: string): string {
  return s.replace(/\/$/, '');
}