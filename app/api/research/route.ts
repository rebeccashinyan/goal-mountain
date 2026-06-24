import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { mountain_id, planning_requests, skill_gaps: inputSkillGaps } =
    await request.json();

  if (!mountain_id) {
    return Response.json({ error: "mountain_id is required" }, { status: 400 });
  }

  const { data: mountain, error: fetchError } = await supabase
    .from("mountains")
    .select("*")
    .eq("id", mountain_id)
    .single();

  if (fetchError || !mountain) {
    return Response.json({ error: "Mountain not found" }, { status: 404 });
  }

  const { data: pastResearch } = await supabase
    .from("research")
    .select("insights, resources")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false })
    .limit(3);

  const { data: memories } = await supabase
    .from("memory")
    .select("content, category")
    .eq("mountain_id", mountain_id)
    .in("category", ["preference", "goal"]);

  const currentMilestone = mountain.milestones[mountain.current_milestone_index];

  const contextParts = [
    `Goal: ${mountain.goal}`,
    `Summit: ${mountain.summit}`,
    `Current stage: ${currentMilestone?.name || "Getting started"} — ${currentMilestone?.description || ""}`,
    `Progress: ${mountain.progress}%`,
  ];

  if (planning_requests) {
    contextParts.push(`\nPlanning requests from user: ${planning_requests}`);
  }

  if (inputSkillGaps) {
    contextParts.push(
      `\nKnown skill gaps to research: ${Array.isArray(inputSkillGaps) ? inputSkillGaps.join(", ") : inputSkillGaps}`
    );
  }

  if (pastResearch?.length) {
    const coveredTopics = pastResearch
      .flatMap(
        (r: { insights: { title: string }[] }) =>
          r.insights?.map((i: { title: string }) => i.title) || []
      );
    contextParts.push(`\nPast research topics (don't repeat): ${JSON.stringify(coveredTopics)}`);
  }

  if (memories?.length) {
    contextParts.push(
      `\nUser context from memory: ${memories.map((m: { content: string }) => m.content).join("; ")}`
    );
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Research Agent for Goal Mountain. You gather external knowledge and real-world data to improve recommendations and planning quality.

Your job:
- Search for relevant information based on the user's goal and current stage
- Analyze industry requirements and best practices
- Compare learning paths and identify the most efficient approach
- Identify skill gaps and surface opportunities and risks
- Recommend specific, actionable resources
- If the user or Planning Agent has specific requests, prioritize those

Return a JSON object:
{
  "insights": [
    { "title": "insight title", "detail": "specific finding relevant to user's current stage" }
  ],
  "resources": [
    { "name": "resource name", "type": "course|book|tool|community|practice", "url": "optional url", "reason": "why this is relevant now" }
  ],
  "skill_gaps": [
    { "skill": "skill name", "priority": "high|medium|low", "current_level": "where the user is now", "target_level": "where they need to be", "suggestion": "how to close this gap" }
  ],
  "market_trends": [
    { "trend": "relevant trend", "impact": "how this affects the user's goal" }
  ],
  "career_benchmarks": [
    { "benchmark": "what successful people at this stage typically do", "relevance": "how this applies to the user" }
  ],
  "best_practices": [
    { "practice": "best practice", "why": "why this matters at the current stage" }
  ],
  "opportunities_and_risks": [
    { "type": "opportunity|risk", "description": "what it is", "action": "what to do about it" }
  ]
}

Rules:
- Focus on the user's CURRENT stage, not the entire journey
- Prioritize actionable resources over general knowledge
- If past research exists, don't repeat the same resources — find new angles
- Consider the user's learning preferences from memory if available
- Be specific: "Couch to 5K app by Cool Running" not "a running app"
- Career benchmarks should be realistic and evidence-based
- Best practices should be stage-appropriate, not generic`,
      },
      {
        role: "user",
        content: contextParts.join("\n"),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json(
      { error: "Failed to generate research" },
      { status: 500 }
    );
  }

  const result = JSON.parse(content);

  const { data, error } = await supabase
    .from("research")
    .insert({
      mountain_id,
      query: `${mountain.goal} — ${currentMilestone?.name || "start"}`,
      insights: result.insights || [],
      resources: result.resources || [],
      skill_gaps: result.skill_gaps || [],
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    ...data,
    market_trends: result.market_trends || [],
    career_benchmarks: result.career_benchmarks || [],
    best_practices: result.best_practices || [],
    opportunities_and_risks: result.opportunities_and_risks || [],
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mountain_id = searchParams.get("mountain_id");

  if (!mountain_id) {
    return Response.json({ error: "mountain_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("research")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
