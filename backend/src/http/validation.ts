export function optionalHttpString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function requiredHttpString(value: unknown): string {
  return optionalHttpString(value) ?? "";
}
