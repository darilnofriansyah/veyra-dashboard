export const DEMO_SESSION_COOKIE = "veyra_demo_session";
export const DEMO_SESSION_VALUE = "active";

export function hasDemoSession(value: string | undefined) {
  return value === DEMO_SESSION_VALUE;
}
