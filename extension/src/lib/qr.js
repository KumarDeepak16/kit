import { encode } from '../../vendor/uqr.mjs';

// Dot-style QR with rounded finder "eyes". Static markup built from numbers only.
export function qrSvg(text) {
  const { size, data } = encode(text, { ecc: 'M', border: 0 });
  const inEye = (r, c) => (r < 7 && (c < 7 || c >= size - 7)) || (r >= size - 7 && c < 7);
  let dots = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) if (data[r][c] && !inEye(r, c)) dots += `<circle cx="${c + 0.5}" cy="${r + 0.5}" r=".44"/>`;
  }
  const eye = (x, y) =>
    `<rect class="qr-eye" x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.9" fill="none" stroke-width="1"/>` +
    `<rect class="qr-pupil" x="${x + 2}" y="${y + 2}" width="3" height="3" rx="1"/>`;
  return `<svg viewBox="-1.5 -1.5 ${size + 3} ${size + 3}" role="img" aria-label="QR code"><g class="qr-dots">${dots}</g>${eye(0, 0)}${eye(size - 7, 0)}${eye(0, size - 7)}</svg>`;
}
