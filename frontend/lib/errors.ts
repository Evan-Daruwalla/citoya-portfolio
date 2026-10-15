import { ApiError } from "@/lib/api";

/** The message to show for a failed call: the server's own words for an ApiError, else the fallback. */
export function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
