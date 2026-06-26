// ── Mountain Generator Agent ──

export interface Milestone {
  name: string;
  description: string;
  completed: boolean;
  current?: boolean;
  order_index: number;
}

export interface Mountain {
  id: string;
  goal: string;
  summit: string;
  current_task: string;
  progress: number;
  current_milestone_index: number;
  milestones: Milestone[];
  running_level?: string;
  race_date?: string;
  constraints?: string;
  created_at: string;
  updated_at: string;
}

// ── Research Agent ──

export interface ResearchResult {
  id: string;
  mountain_id: string;
  query: string;
  insights: { title: string; detail: string }[];
  resources: { name: string; type: string; url?: string; reason: string }[];
  skill_gaps: { skill: string; priority: string; suggestion: string }[];
  created_at: string;
}

// ── Planning + Strategy Agent ──

export interface DayPlan {
  day: string;
  tasks: { task: string; duration: string; priority: string }[];
}

export interface WeeklyPlan {
  id: string;
  mountain_id: string;
  week_start: string;
  plan: {
    schedule: DayPlan[];
    focus_area: string;
    difficulty_level: string;
  };
  priority_recommendation: string;
  next_best_action: string;
  strategy_notes: string;
  created_at: string;
}

// ── Progress Tracking Agent ──

export interface ProgressLog {
  id: string;
  mountain_id: string;
  log_type: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface ProgressSummary {
  progress_percentage: number;
  current_camp: string;
  milestone_completion: { name: string; completed: boolean }[];
  trend: "ahead" | "on_track" | "behind";
  risk_signals: string[];
}

// ── Reflection Agent ──

export interface Reflection {
  id: string;
  mountain_id: string;
  week_start: string;
  user_input: {
    weekly_progress: string;
    missed_activities: string;
    energy_level: number;
    motivation_level: number;
    obstacles: string;
    feedback: string;
  };
  summary: string;
  lessons_learned: string[];
  blockers: { blocker: string; frequency: number; suggestion: string }[];
  adjustments: string[];
  created_at: string;
}

// ── Memory Agent ──

export type MemoryCategory =
  | "goal"
  | "behavior_pattern"
  | "motivation"
  | "obstacle"
  | "preference"
  | "milestone_context"
  | "reflection_insight";

export interface Memory {
  id: string;
  mountain_id: string;
  category: MemoryCategory;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  behavior_patterns: string[];
  motivation_profile: string[];
  journey_history_summary: string;
  personalized_context: string[];
}
