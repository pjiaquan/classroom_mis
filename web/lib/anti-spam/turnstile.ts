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
  ipAddress?: string,
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

  try {
    const body = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    });

    if (ipAddress) {
      body.set("remoteip", ipAddress.split(",")[0]?.trim() ?? ipAddress);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        error: "Captcha verification failed.",
      };
    }

    const result = (await response.json()) as {
      success?: boolean;
    };

    if (!result.success) {
      return {
        ok: false,
        error: "Captcha verification failed.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Captcha verification failed.",
    };
  }
}
