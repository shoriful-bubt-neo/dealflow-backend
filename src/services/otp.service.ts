import redis from "../config/redis.js";

const OTP_TTL_SECONDS = 300;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_MAX = 3;

function otpKey(id: string): string {
  return `otp:${id}`;
}

function rateKey(id: string): string {
  return `otp:rate:${id}`;
}

export async function generateOtp(id: string): Promise<string> {
  const rk = rateKey(id);
  const count = await redis.incr(rk);
  if (count === 1) {
    await redis.expire(rk, RATE_LIMIT_WINDOW_SECONDS);
  }
  if (count > RATE_LIMIT_MAX) {
    throw new Error("OTP rate limit exceeded. Try again in 15 minutes.");
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await redis.set(otpKey(id), code, "EX", OTP_TTL_SECONDS);
  return code;
}

export async function verifyOtp(id: string, code: string): Promise<boolean> {
  const key = otpKey(id);
  const stored = await redis.get(key);
  if (!stored || stored !== code) {
    return false;
  }
  await redis.del(key);
  return true;
}
