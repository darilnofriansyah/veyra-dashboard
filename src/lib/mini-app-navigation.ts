export function miniAppDestination(startParam: unknown): string {
  const match = typeof startParam === "string" ? /^pocket_([1-9]\d*)$/.exec(startParam) : null;
  return match ? `/pockets/${match[1]}` : "/dashboard";
}
