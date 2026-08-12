export type OtpChannel = "WHATSAPP" | "EMAIL" | "SMS";

export type DispatchOtpResult = {
  channel: OtpChannel;
};

async function sendWhatsAppMock(phone: string, code: string): Promise<void> {
  console.log(`[OTP:WhatsApp] to=${phone} code=${code}`);
}

async function sendEmailMock(email: string, code: string): Promise<void> {
  console.log(`[OTP:Email] to=${email} code=${code}`);
}

async function sendSmsMock(phone: string, code: string): Promise<void> {
  console.log(`[OTP:SMS] to=${phone} code=${code}`);
}

export async function dispatchOtp(
  phone: string,
  email: string,
  code: string,
): Promise<DispatchOtpResult> {
  try {
    await sendWhatsAppMock(phone, code);
    return { channel: "WHATSAPP" };
  } catch {
    try {
      await sendEmailMock(email, code);
      return { channel: "EMAIL" };
    } catch {
      try {
        await sendSmsMock(phone, code);
        return { channel: "SMS" };
      } catch {
        throw new Error("All OTP delivery channels failed");
      }
    }
  }
}
