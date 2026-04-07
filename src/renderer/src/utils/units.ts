export const mmToPx = (mm: number, dpi = 96): number => (mm / 25.4) * dpi
export const pxToMm = (px: number, dpi = 96): number => (px / dpi) * 25.4
export const mmToPt = (mm: number): number => (mm / 25.4) * 72
export const inToMm = (inches: number): number => inches * 25.4

// For CSS preview scaling — converts mm to css pixels at 96 DPI (screen)
export const mmToCssPx = (mm: number): number => mmToPx(mm, 96)
