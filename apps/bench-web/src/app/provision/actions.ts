"use server";

import { redirect } from "next/navigation";
import { BenchApiError, benchApi } from "@/lib/bench-api";

export async function provisionTenant(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const plan = (formData.get("plan") ?? "starter") as
    | "starter"
    | "pro"
    | "enterprise";

  try {
    const r = await benchApi.createTenant({
      slug,
      ownerEmail,
      ownerName,
      plan,
    });
    redirect(`/tenants?created=${encodeURIComponent(r.subdomain)}`);
  } catch (err) {
    if (err instanceof BenchApiError) {
      redirect(
        `/provision?error=${encodeURIComponent(`${err.code}: ${err.message}`)}`,
      );
    }
    throw err;
  }
}
