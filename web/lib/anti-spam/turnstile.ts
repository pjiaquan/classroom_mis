type TurnstileVerificationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export async function verifyTurnstileToken(
  token: string | undefined,
): Promise<TurnstileVerificationResult> {
  if (!process.env.TURNSTILE_SECRET_KEY) {
    return { ok: true };
  }

  if (!token) {
    return {
      ok: false,
      error: "Captcha verification failed.",
    };
  }

  // Real implementation: POST to Cloudflare Turnstile siteverify.
  return { ok: true };
}
