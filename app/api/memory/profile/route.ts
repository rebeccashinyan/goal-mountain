import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mountain_id = searchParams.get("mountain_id");

  if (!mountain_id) {
    return Response.json({ error: "mountain_id is required" }, { status: 400 });
  }

  const { data: memories } = await supabase
    .from("memory")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false });

  const { data: reflections } = await supabase
    .from("reflections")
    .select("summary, lessons_learned, blockers")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false })
    .limit(8);

  const { data: mountain } = await supabase
    .from("mountains")
    .select("goal, summit, progress, milestones")
    .eq("id", mountain_id)
    .single();

  if (!memories?.length && !reflections?.length) {
    return Response.json({
      behavior_patterns: [],
      motivation_profile: [],
      journey_history_summary: "No data yet — start logging progress to build your profile.",
      personalized_context: [],
    });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Memory Agent for Goal Mountain. You synthesize all stored memories and reflections into a user profile that helps other agents personalize their recommendations.

Return a JSON object:
{
  "behavior_patterns": ["pattern 1", "pattern 2"],
  "motivation_profile": ["what motivates this user", "what demotivates them"],
  "journey_history_summary": "brief summary of their journey so far",
  "personalized_context": ["context item that other agents should know"]
}

Rules:
- Synthesize, don't just list — find patterns across memories
- Focus on actionable insights that help planning and reflection
- Be specific: "Performs best with focused morning sessions on weekdays" not "Likes mornings"
- Adapt your analysis to the goal type — fitness, career, learning, creative goals all have different behavioral patterns`,
      },
      {
        role: "user",
        content: `Goal: ${mountain?.goal || "Unknown"}
Progress: ${mountain?.progress || 0}%

Stored memories:
${JSON.stringify(memories?.map((m: { category: string; content: string; created_at: string }) => ({ category: m.category, content: m.content, date: m.created_at })) || [])}

Reflection history:
${JSON.stringify(reflections || [])}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json(
      { error: "Failed to generate profile" },
      { status: 500 }
    );
  }

  return Response.json(JSON.parse(content));
}
