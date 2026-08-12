import axios from "axios";
import {
  PORICHOY_API_KEY,
  PORICHOY_BASE_URL,
} from "../../../config/kyc.js";
import type { IKycProvider, NidVerifyResult } from "../types.js";

/**
 * Production Porichoy adapter.
 * Endpoint shape follows Porichoy NID person API; adjust path if vendor docs differ.
 */
export class RealPorichoyProvider implements IKycProvider {
  readonly vendor = "PORICHOY" as const;

  async verifyNid(nidNumber: string, dateOfBirth: string): Promise<NidVerifyResult> {
    if (!PORICHOY_API_KEY) {
      return {
        success: false,
        code: "VENDOR_ERROR",
        message: "PORICHOY_API_KEY is not configured",
        vendor: this.vendor,
      };
    }

    const nid = nidNumber.replace(/\D/g, "");

    try {
      const { data } = await axios.post(
        `${PORICHOY_BASE_URL}/api/v2/verifications/autofill`,
        {
          nidNumber: nid,
          dateOfBirth,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": PORICHOY_API_KEY,
          },
          timeout: 20_000,
        },
      );

      const pass = Boolean(data?.pass || data?.data?.pass || data?.success);
      if (!pass) {
        const code =
          data?.errorCode === "NID_NOT_FOUND" || data?.message?.includes("not found")
            ? "NID_NOT_FOUND"
            : "NID_MISMATCH";
        return {
          success: false,
          code,
          message: data?.message || "Porichoy NID verification failed",
          vendor: this.vendor,
          raw: data,
        };
      }

      const person = data?.data || data?.person || data;
      const name =
        person?.nameEn ||
        person?.name ||
        person?.fullName ||
        [person?.firstName, person?.lastName].filter(Boolean).join(" ") ||
        "UNKNOWN";
      const dob = person?.dateOfBirth || person?.dob || dateOfBirth;
      const photoBase64 =
        typeof person?.photo === "string"
          ? person.photo.replace(/^data:image\/\w+;base64,/, "")
          : typeof person?.photoBase64 === "string"
            ? person.photoBase64.replace(/^data:image\/\w+;base64,/, "")
            : undefined;

      return {
        success: true,
        name: String(name),
        dateOfBirth: String(dob),
        photoBase64,
        vendor: this.vendor,
        raw: data,
      };
    } catch (error: unknown) {
      const message =
        axios.isAxiosError(error)
          ? error.response?.data?.message || error.message
          : error instanceof Error
            ? error.message
            : "Porichoy request failed";

      return {
        success: false,
        code: "VENDOR_ERROR",
        message: String(message),
        vendor: this.vendor,
        raw: axios.isAxiosError(error) ? error.response?.data : undefined,
      };
    }
  }
}
