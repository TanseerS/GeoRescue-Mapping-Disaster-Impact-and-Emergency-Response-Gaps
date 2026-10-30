import type { Map as MapLibreMap } from "maplibre-gl";
import { FACILITY_COLORS } from "../../config/constants";
import type { FacilityKind } from "../../types/facility";

const PIXEL_RATIO = 2;
const SIZE = 22;

function draw(paint: (ctx: CanvasRenderingContext2D, s: number) => void): ImageData | null {
  const canvas = document.createElement("canvas");
  const px = SIZE * PIXEL_RATIO;
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO);
  paint(ctx, SIZE);
  return ctx.getImageData(0, 0, px, px);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function badge(ctx: CanvasRenderingContext2D, s: number, color: string, shape: "square" | "circle") {
  if (shape === "square") roundedRect(ctx, 2, 2, s - 4, s - 4, 5);
  else {
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#06101f";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
}

/** Each facility type gets a distinct glyph; color encodes the group (health vs emergency services). */
const PAINTERS: Record<FacilityKind, (ctx: CanvasRenderingContext2D, s: number) => void> = {
  hospital: (ctx, s) => {
    badge(ctx, s, FACILITY_COLORS.hospital, "square");
    const c = s / 2;
    ctx.fillRect(c - 1.6, c - 5.5, 3.2, 11);
    ctx.fillRect(c - 5.5, c - 1.6, 11, 3.2);
  },
  clinic: (ctx, s) => {
    badge(ctx, s, FACILITY_COLORS.hospital, "circle");
    const c = s / 2;
    ctx.fillRect(c - 1.1, c - 4, 2.2, 8);
    ctx.fillRect(c - 4, c - 1.1, 8, 2.2);
  },
  fire_station: (ctx, s) => {
    badge(ctx, s, FACILITY_COLORS.emergency, "circle");
    const c = s / 2;
    ctx.beginPath();
    ctx.moveTo(c, c - 5.5);
    ctx.lineTo(c + 5.5, c + 4.5);
    ctx.lineTo(c - 5.5, c + 4.5);
    ctx.closePath();
    ctx.fill();
  },
  ambulance_station: (ctx, s) => {
    badge(ctx, s, FACILITY_COLORS.emergency, "circle");
    const c = s / 2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c, c, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(c - 0.9, c - 3, 1.8, 6);
    ctx.fillRect(c - 3, c - 0.9, 6, 1.8);
  },
  police: (ctx, s) => {
    badge(ctx, s, FACILITY_COLORS.emergency, "circle");
    const c = s / 2;
    ctx.beginPath();
    ctx.moveTo(c, c - 5.5);
    ctx.lineTo(c + 4.5, c - 3);
    ctx.lineTo(c + 3.5, c + 2.5);
    ctx.lineTo(c, c + 5.5);
    ctx.lineTo(c - 3.5, c + 2.5);
    ctx.lineTo(c - 4.5, c - 3);
    ctx.closePath();
    ctx.fill();
  },
};

export const facilityIconId = (kind: FacilityKind) => `icon-${kind}`;

export function registerMapIcons(map: MapLibreMap) {
  for (const [kind, paint] of Object.entries(PAINTERS) as [FacilityKind, (ctx: CanvasRenderingContext2D, s: number) => void][]) {
    const name = facilityIconId(kind);
    const data = draw(paint);
    if (data && !map.hasImage(name)) map.addImage(name, data, { pixelRatio: PIXEL_RATIO });
  }
}
