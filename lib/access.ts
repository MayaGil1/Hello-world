import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Admins manage both lists in the admin panel. If both are empty, anyone can sign in.
// Otherwise the email must be on a listed domain (subdomains count) or be whitelisted itself.
export async function isEmailAllowed(rawEmail: string | undefined) {
  const email = rawEmail?.trim().toLowerCase();
  if (!email) return false;

  const admin = createAdminClient();
  const [domains, emails] = await Promise.all([
    admin.from("allowed_signup_domains").select("apex_domain"),
    admin.from("whitelist_email_addresses").select("email_address"),
  ]);
  if (domains.error || emails.error) {
    console.error(domains.error ?? emails.error);
    return false;
  }
  if (domains.data.length === 0 && emails.data.length === 0) return true;

  const domain = email.split("@")[1] ?? "";
  return (
    emails.data.some((row) => row.email_address === email) ||
    domains.data.some((row) => domain === row.apex_domain || domain.endsWith(`.${row.apex_domain}`))
  );
}
