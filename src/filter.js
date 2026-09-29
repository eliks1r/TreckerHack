import {
  ONE_EURO_BETA,
  ONE_EURO_D_CUTOFF,
  ONE_EURO_MIN_CUTOFF,
  VISIBILITY_THRESHOLD,
} from "./config.js";

function alpha(cutoff, elapsedSeconds) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / elapsedSeconds);
}

export function createOneEuroFilter({
  minCutoff = ONE_EURO_MIN_CUTOFF,
  beta = ONE_EURO_BETA,
  dCutoff = ONE_EURO_D_CUTOFF,
} = {}) {
  let lastTimeMs = null;
  let lastRaw = null;
  let filtered = null;
  let filteredDerivative = 0;

  return {
    filter(value, nowMs) {
      if (!Number.isFinite(value) || !Number.isFinite(nowMs)) return value;
      if (lastTimeMs === null) {
        lastTimeMs = nowMs;
        lastRaw = value;
        filtered = value;
        return value;
      }
      if (nowMs <= lastTimeMs) return filtered;

      const dt = (nowMs - lastTimeMs) / 1000;
      const speed = (value - lastRaw) / dt;
      filteredDerivative += alpha(dCutoff, dt) * (speed - filteredDerivative);
      const cutoff = minCutoff + beta * Math.abs(filteredDerivative);
      filtered += alpha(cutoff, dt) * (value - filtered);
      lastTimeMs = nowMs;
      lastRaw = value;
      return filtered;
    },
    reset() {
      lastTimeMs = null;
      lastRaw = null;
      filtered = null;
      filteredDerivative = 0;
    },
  };
}

export function createLandmarkSmoother(options) {
  let filters = [];

  return {
    smooth(landmarks, nowMs) {
      if (!Array.isArray(landmarks)) return null;
      return landmarks.map((point, index) => {
        if (!filters[index]) {
          filters[index] = {
            x: createOneEuroFilter(options),
            y: createOneEuroFilter(options),
          };
        }
        const pair = filters[index];
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
            (point.visibility ?? 1) < VISIBILITY_THRESHOLD) {
          pair.x.reset();
          pair.y.reset();
          return point ? { ...point } : point;
        }
        return {
          ...point,
          x: pair.x.filter(point.x, nowMs),
          y: pair.y.filter(point.y, nowMs),
        };
      });
    },
    reset() {
      filters = [];
    },
  };
}
