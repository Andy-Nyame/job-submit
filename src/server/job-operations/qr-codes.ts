import "server-only";

import QRCode from "qrcode";

function applicationOrigin() {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) {
    const origin = new URL(configured).origin;
    if (!origin.startsWith("https://") && process.env.NODE_ENV === "production") {
      throw new Error("APP_ORIGIN must use HTTPS in production.");
    }
    return origin;
  }
  const vercelOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercelOrigin
    ? `https://${vercelOrigin}`
    : "https://capt-bob-cedis-artworks.vercel.app";
}

export function staffJobUrl(publicReference: string) {
  return new URL(
    `/app/staff/jobs/${encodeURIComponent(publicReference)}`,
    applicationOrigin(),
  ).toString();
}

export function pickupScanUrl(code: string) {
  const url = new URL("/app/staff/pickup", applicationOrigin());
  url.hash = code;
  return url.toString();
}

export function qrDataUrl(value: string) {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 6,
    type: "image/png",
  });
}
