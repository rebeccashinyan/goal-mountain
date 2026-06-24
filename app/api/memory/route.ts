import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { mountain_id, category, content, metadata } = await request.json();

  if (!mountain_id || !category || !content) {
    return Response.json(
      { error: "mountain_id, category, and content are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("memory")
    .insert({
      mountain_id,
      category,
      content,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mountain_id = searchParams.get("mountain_id");
  const category = searchParams.get("category");

  if (!mountain_id) {
    return Response.json({ error: "mountain_id is required" }, { status: 400 });
  }

  let query = supabase
    .from("memory")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("memory").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
