import type { IKycProvider, NidVerifyResult } from "../types.js";

/** 1×1 JPEG — placeholder EC photo for local mock responses */
const MOCK_EC_PHOTO_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z";

/**
 * Local Porichoy simulator.
 * - NID starting with "19" OR exactly 10 digits → success
 * - NID "0000000000" → NID_NOT_FOUND
 */
export class MockPorichoyProvider implements IKycProvider {
  readonly vendor = "PORICHOY_MOCK" as const;

  async verifyNid(nidNumber: string, dateOfBirth: string): Promise<NidVerifyResult> {
    const nid = nidNumber.replace(/\D/g, "");

    if (nid === "0000000000") {
      return {
        success: false,
        code: "NID_NOT_FOUND",
        message: "NID not found in Election Commission records (mock)",
        vendor: this.vendor,
      };
    }

    const isTenDigits = /^\d{10}$/.test(nid);
    const startsWith19 = nid.startsWith("19");
    if (!isTenDigits && !startsWith19) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Mock provider accepts 10-digit NID or NID starting with 19",
        vendor: this.vendor,
      };
    }

    return {
      success: true,
      name: "MOCK USER RAHMAN",
      dateOfBirth,
      photoBase64: MOCK_EC_PHOTO_BASE64,
      photoS3Key: `kyc/mock/ec-photos/${nid}.jpg`,
      vendor: this.vendor,
      raw: {
        provider: "MockPorichoyProvider",
        nid,
        matched: true,
      },
    };
  }
}
