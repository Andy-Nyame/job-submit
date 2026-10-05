export const EXPRESS_SURCHARGE_BASIS_POINTS = 4_000n;
export const BASIS_POINTS_DENOMINATOR = 10_000n;

export const COMPLEXITY_STARS = {
  SIMPLE: 1,
  MEDIUM: 2,
  COMPLEX: 3,
} as const;

export type JobComplexity = keyof typeof COMPLEXITY_STARS;

export function calculateSurchargeMinor(
  basePriceMinor: bigint,
  surchargeBasisPoints: bigint,
) {
  if (basePriceMinor < 0n) {
    throw new RangeError("Base price cannot be negative.");
  }

  if (surchargeBasisPoints < 0n) {
    throw new RangeError("Surcharge basis points cannot be negative.");
  }

  return (
    (basePriceMinor * surchargeBasisPoints + BASIS_POINTS_DENOMINATOR / 2n) /
    BASIS_POINTS_DENOMINATOR
  );
}

export function calculateExpressPrice(basePriceMinor: bigint) {
  const surchargeMinor = calculateSurchargeMinor(
    basePriceMinor,
    EXPRESS_SURCHARGE_BASIS_POINTS,
  );

  return {
    basePriceMinor,
    surchargeBasisPoints: EXPRESS_SURCHARGE_BASIS_POINTS,
    surchargeMinor,
    totalMinor: basePriceMinor + surchargeMinor,
  };
}

export function starsForComplexity(complexity: JobComplexity) {
  return COMPLEXITY_STARS[complexity];
}
