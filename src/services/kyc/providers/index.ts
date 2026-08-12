import { resolveKycProviderMode } from "../../../config/kyc.js";
import type { IKycProvider } from "../types.js";
import { MockPorichoyProvider } from "./mockPorichoy.provider.js";
import { RealPorichoyProvider } from "./realPorichoy.provider.js";

let cached: IKycProvider | null = null;

/** Dynamically select Mock (dev) or Real Porichoy (prod) without call-site changes. */
export function getKycProvider(): IKycProvider {
  if (cached) return cached;

  const mode = resolveKycProviderMode();
  cached =
    mode === "mock" ? new MockPorichoyProvider() : new RealPorichoyProvider();

  return cached;
}

/** Test helper — clears singleton cache. */
export function resetKycProviderCache(): void {
  cached = null;
}
