import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mountain_id = searchParams.get("mountain_id");

  let query = supabase
    .from("guide_chats")
    .select("*")
    .order("updated_at", { ascending: false });

  if (mountain_id) query = query.eq("mountain_id", mountain_id);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(request: Request) {
  const { mountain_id, title, type } = await request.json();

  if (!title) return Response.json({ error: "title is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("guide_chats")
    .insert({ mountain_id: mountain_id || null, title, type: type || "user_initiated", unread: false })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

// Deleting a chat cascades to its guide_messages via FK
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase.from("guide_chats").delete().eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
