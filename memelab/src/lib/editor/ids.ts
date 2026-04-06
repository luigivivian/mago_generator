let idCounter = 0;

export function genId(prefix = "scene"): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}
