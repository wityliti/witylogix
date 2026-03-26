"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/* ═══════════════════════════════════════════════════════════
   AUTH SERVER ACTIONS — Production implementations
   ═══════════════════════════════════════════════════════════ */

// ─── Zod Schemas ────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  shopDomain: z.string().min(1, "Shop domain is required"),
  rememberMe: z.boolean().optional().default(false),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  agreeTerms: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms and conditions",
  }),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  shopDomain: z.string().min(1, "Shop domain is required"),
});

// ─── Types ──────────────────────────────────────────────────

interface ApiErrorResponse {
  error?: string;
  fieldErrors?: Record<string, string>;
  code?: string;
}

interface LoginResponse {
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
    user: { id: string; name: string; email: string; role: string };
    shop: { id: string; name: string; domain: string };
    orgId?: string;
    orgRole?: string;
  };
}

interface RegisterResponse {
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
    user: { id: string; name: string; email: string; role: string };
  };
}

type ActionResponse<T = void> = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
};

// ─── Helpers ────────────────────────────────────────────────

async function fetchApi<T>(
  endpoint: string,
  body: unknown,
): Promise<{ data?: T; error?: ApiErrorResponse; status: number }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${apiUrl}/api/v4/auth${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseData = (await response.json()) as T & ApiErrorResponse;

    if (!response.ok) {
      return {
        error: responseData as ApiErrorResponse,
        status: response.status,
      };
    }

    return {
      data: (responseData as T) || responseData,
      status: response.status,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return {
      error: {
        error: `Network error: ${errorMessage}`,
        code: "NETWORK_ERROR",
      },
      status: 0,
    };
  }
}

async function setCookies(
  accessToken: string,
  refreshToken: string,
  expiresIn: string,
  rememberMe?: boolean,
): Promise<void> {
  const cookieStore = await cookies();

  // Parse expiry time (e.g., "1h" -> 3600 seconds)
  let maxAge = 3600; // Default 1 hour
  if (expiresIn.endsWith("d")) {
    maxAge = parseInt(expiresIn) * 24 * 60 * 60;
  } else if (expiresIn.endsWith("h")) {
    maxAge = parseInt(expiresIn) * 60 * 60;
  }

  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge,
    path: "/",
  });

  // Store refresh token with longer TTL (30 days typical)
  const refreshMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
  cookieStore.set("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: refreshMaxAge,
    path: "/",
  });
}

// ─── Login Action ───────────────────────────────────────────

export async function loginAction(
  formData: FormData,
): Promise<ActionResponse> {
  try {
    // Extract and parse form data
    const rawData = {
      email: formData.get("email"),
      password: formData.get("password"),
      shopDomain: formData.get("shopDomain") || "default",
      rememberMe: formData.get("rememberMe") === "true",
    };

    // Validate with zod
    const validation = loginSchema.safeParse(rawData);

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const error of validation.error.errors) {
        const fieldName = error.path[0] as string;
        fieldErrors[fieldName] = error.message;
      }
      return {
        success: false,
        error: "Validation failed",
        fieldErrors,
      };
    }

    const { email, password, shopDomain, rememberMe } = validation.data;

    // Call API
    const result = await fetchApi<LoginResponse>("/login", {
      email,
      password,
      shopDomain,
    });

    if (result.error) {
      if (result.status === 401) {
        return {
          success: false,
          error: "Invalid email or password",
        };
      }

      if (result.status === 400) {
        return {
          success: false,
          error: result.error.error || "Invalid request",
          fieldErrors: result.error.fieldErrors,
        };
      }

      return {
        success: false,
        error: result.error.error || "Login failed",
      };
    }

    if (!result.data?.data) {
      return {
        success: false,
        error: "Invalid response from server",
      };
    }

    const { accessToken, refreshToken, expiresIn } = result.data.data;

    // Set cookies
    await setCookies(accessToken, refreshToken, expiresIn, rememberMe);

    // Redirect to dashboard
    redirect("/dashboard");
  } catch (error) {
    console.error("Login action error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during login",
    };
  }
}

// ─── Register Action ────────────────────────────────────────

export async function registerAction(
  formData: FormData,
): Promise<ActionResponse> {
  try {
    // Extract and parse form data
    const rawData = {
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      agreeTerms: formData.get("agreeTerms") === "true",
    };

    // Validate with zod
    const validation = registerSchema.safeParse(rawData);

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const error of validation.error.errors) {
        const fieldName = error.path[0] as string;
        fieldErrors[fieldName] = error.message;
      }
      return {
        success: false,
        error: "Validation failed",
        fieldErrors,
      };
    }

    const { name, email, password } = validation.data;

    // Call API
    const result = await fetchApi<RegisterResponse>("/register", {
      name,
      email,
      password,
    });

    if (result.error) {
      if (result.status === 409) {
        return {
          success: false,
          error: "Email already registered",
          fieldErrors: { email: "This email is already in use" },
        };
      }

      if (result.status === 400) {
        return {
          success: false,
          error: result.error.error || "Invalid registration data",
          fieldErrors: result.error.fieldErrors,
        };
      }

      return {
        success: false,
        error: result.error.error || "Registration failed",
      };
    }

    if (!result.data?.data) {
      return {
        success: false,
        error: "Invalid response from server",
      };
    }

    const { accessToken, refreshToken, expiresIn } = result.data.data;

    // Set cookies (auto-logged in after register)
    await setCookies(accessToken, refreshToken, expiresIn, false);

    // Redirect to dashboard
    redirect("/dashboard");
  } catch (error) {
    console.error("Register action error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during registration",
    };
  }
}

// ─── Forgot Password Action ─────────────────────────────────

export async function forgotPasswordAction(
  formData: FormData,
): Promise<ActionResponse> {
  try {
    // Extract and parse form data
    const rawData = {
      email: formData.get("email"),
      shopDomain: formData.get("shopDomain") || "default",
    };

    // Validate with zod
    const validation = forgotPasswordSchema.safeParse(rawData);

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const error of validation.error.errors) {
        const fieldName = error.path[0] as string;
        fieldErrors[fieldName] = error.message;
      }
      return {
        success: false,
        error: "Validation failed",
        fieldErrors,
      };
    }

    const { email, shopDomain } = validation.data;

    // Call API
    const result = await fetchApi("/forgot-password", {
      email,
      shopDomain,
    });

    // Always return success (don't leak user existence)
    // API follows same pattern
    return {
      success: true,
    };
  } catch (error) {
    console.error("Forgot password action error:", error);
    // Still return success to avoid leaking user existence
    return {
      success: true,
    };
  }
}
