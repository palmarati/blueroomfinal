import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function GET() {
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    redirect("/auth/login");
  }

  // Attempt to auto-link client by email to this user
  try {
    await supabase.rpc("link_client_to_current_user");
  } catch {}

  const userId = session.session!.user.id;
  const { data: isAdminRow } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();

  if (isAdminRow?.user_id) {
    redirect("/dashboard");
  }

  // Check if user already has a linked client
  const { data: client } = await supabase.from("clients").select("id").eq("user_id", userId).maybeSingle();
  if (client?.id) {
    redirect("/portal");
  }

  // Otherwise send to onboarding to create a client
  redirect("/user/create");
}


