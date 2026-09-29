// Small pixel-corrected helpers for pose quality and neutral-stance calibration.
export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distancePx(a, b, videoWidth, videoHeight) {
  return Math.hypot(
    (a.x - b.x) * videoWidth,
    (a.y - b.y) * videoHeight,
  );
}

export function anglePx(a, b, c, videoWidth, videoHeight) {
  const bax = (a.x - b.x) * videoWidth;
  const bay = (a.y - b.y) * videoHeight;
  const bcx = (c.x - b.x) * videoWidth;
  const bcy = (c.y - b.y) * videoHeight;
  const length = Math.hypot(bax, bay) * Math.hypot(bcx, bcy);
  if (!length) return NaN;
  const cosine = Math.max(-1, Math.min(1, (bax * bcx + bay * bcy) / length));
  return Math.acos(cosine) * 180 / Math.PI;
}
