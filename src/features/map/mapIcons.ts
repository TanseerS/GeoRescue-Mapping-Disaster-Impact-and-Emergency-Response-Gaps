import type { Map as MapLibreMap } from "maplibre-gl";
import { FACILITY_COLORS } from "../../config/constants";

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

/** Hospital: rounded square with a medical cross. */
function hospitalIcon(): ImageData | null {
  return draw((ctx, s) => {
    roundedRect(ctx, 2, 2, s - 4, s - 4, 5);
    ctx.fillStyle = FACILITY_COLORS.hospital;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#06101f";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    const c = s / 2;
    ctx.fillRect(c - 1.6, c - 5.5, 3.2, 11);
    ctx.fillRect(c - 5.5, c - 1.6, 11, 3.2);
  });
}

/** Emergency facility: circle with an alert triangle. */
function emergencyIcon(): ImageData | null {
  return draw((ctx, s) => {
    const c = s / 2;
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fillStyle = FACILITY_COLORS.emergency;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#06101f";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c, c - 5.5);
    ctx.lineTo(c + 5.5, c + 4.5);
    ctx.lineTo(c - 5.5, c + 4.5);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  });
}

export function registerMapIcons(map: MapLibreMap) {
  const icons: [string, ImageData | null][] = [
    ["icon-hospital", hospitalIcon()],
    ["icon-emergency", emergencyIcon()],
  ];
  for (const [name, data] of icons) {
    if (data && !map.hasImage(name)) map.addImage(name, data, { pixelRatio: PIXEL_RATIO });
  }
}
