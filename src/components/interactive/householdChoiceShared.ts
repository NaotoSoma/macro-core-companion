export type Point = {
  x: number;
  y: number;
};

type GridResult = {
  x: number;
  value: number;
};

const EPSILON = 1e-8;

export function sampleRange(min: number, max: number, steps: number): number[] {
  if (steps <= 1 || min === max) {
    return [min];
  }

  const stepSize = (max - min) / (steps - 1);
  return Array.from({ length: steps }, (_, index) => min + stepSize * index);
}

export function buildPath(points: Point[], scaleX: (x: number) => number, scaleY: (y: number) => number): string {
  const validPoints = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  if (validPoints.length === 0) {
    return '';
  }

  return validPoints
    .map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${scaleX(point.x).toFixed(3)} ${scaleY(point.y).toFixed(3)}`;
    })
    .join(' ');
}

export function argmaxGrid(min: number, max: number, steps: number, objective: (x: number) => number): GridResult {
  let best: GridResult = { x: min, value: Number.NEGATIVE_INFINITY };

  for (const x of sampleRange(min, max, steps)) {
    const value = objective(x);
    if (value > best.value) {
      best = { x, value };
    }
  }

  return best;
}

export function safeLog(value: number): number {
  return Math.log(Math.max(value, EPSILON));
}

export function crraUtility(consumption: number, sigma: number): number {
  const safeConsumption = Math.max(consumption, EPSILON);

  if (Math.abs(sigma - 1) < 1e-6) {
    return Math.log(safeConsumption);
  }

  return (safeConsumption ** (1 - sigma) - 1) / (1 - sigma);
}

export function marginalUtility(consumption: number, sigma: number): number {
  return Math.max(consumption, EPSILON) ** -sigma;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  return value.toFixed(2);
}
