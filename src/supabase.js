import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://pkxwglkzqmxuezgszztl.supabase.co",
  "sb_publishable_hVWzKf_p3c4zB5OhaYdSRA_Ce6DX9M-"
);

export const ADMIN_EMAIL = "admin@youthon.kr";

export function getDisplayName(user) {
  if (!user) return "";
  if (user.email === ADMIN_EMAIL) return "관리자";
  return user.user_metadata?.name || user.email?.split("@")[0] || "";
}
