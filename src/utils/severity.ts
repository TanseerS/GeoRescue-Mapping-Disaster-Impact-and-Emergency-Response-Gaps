import { SEVERITIES, SEVERITY_BY_ID } from "../config/constants";
import type { SeverityLevel } from "../types/earthquake";

export function getSeverity(magnitude: number): SeverityLevel {
  for (let i = SEVERITIES.length - 1; i >= 0; i -= 1) {
    if (magnitude >= SEVERITIES[i].min) return SEVERITIES[i].id;
  }
  return "minor";
}

export function severityColor(level: SeverityLevel): string {
  return SEVERITY_BY_ID[level].color;
}

export function severityLabel(level: SeverityLevel): string {
  return SEVERITY_BY_ID[level].label;
}
