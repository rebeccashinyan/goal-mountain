export interface Milestone {
  name: string;
  description: string;
  completed: boolean;
  current?: boolean;
}

export interface Mountain {
  id: string;
  goal: string;
  currentTask: string;
  progress: number;
  currentMilestoneIndex: number;
  milestones: Milestone[];
  summit: string;
}

export interface Risk {
  title: string;
  detected: number;
  impact: "High" | "Medium" | "Low";
  suggestedFix: string;
}

export interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string;
  actions?: { label: string; id: string }[];
}

export const mountains: Mountain[] = [
  {
    id: "1",
    goal: "Become an AI Product Designer",
    currentTask: "Complete UX case study for AI chatbot",
    progress: 42,
    currentMilestoneIndex: 4,
    summit: "Land an AI Product Designer Role",
    milestones: [
      { name: "Define Career Goal", description: "Research the role", completed: true },
      { name: "Learn UX Fundamentals", description: "Complete UX course", completed: true },
      { name: "Study AI/ML Basics", description: "Understand ML concepts", completed: true },
      { name: "Complete First Case Study", description: "AI product case study", completed: true },
      { name: "Build AI Product Project", description: "Create a working prototype", completed: false, current: true },
      { name: "Complete Second Case Study", description: "Another case study", completed: false },
      { name: "Launch Portfolio Website", description: "Deploy portfolio", completed: false },
      { name: "Network with Designers", description: "Industry connections", completed: false },
      { name: "Apply to Positions", description: "Submit applications", completed: false },
    ],
  },
  {
    id: "2",
    goal: "Run a 10K Road Race",
    currentTask: "No Task Today",
    progress: 30,
    currentMilestoneIndex: 2,
    summit: "Complete a 10K Race",
    milestones: [
      { name: "Build Running Habit", description: "Run 3x/week", completed: true },
      { name: "Run 2K Consistently", description: "Comfortable 2K", completed: true },
      { name: "Run 5K", description: "Build to 5K", completed: false, current: true },
      { name: "Run 5K Under 30min", description: "Improve time", completed: false },
      { name: "Run 8K", description: "Longer distances", completed: false },
      { name: "Run 8K Consistently", description: "Multiple 8K/week", completed: false },
      { name: "Race Prep", description: "Taper for race", completed: false },
    ],
  },
  {
    id: "3",
    goal: "Learn Japanese",
    currentTask: "Practice Hiragana writing drills",
    progress: 15,
    currentMilestoneIndex: 1,
    summit: "Pass JLPT N3",
    milestones: [
      { name: "Learn Hiragana", description: "Master hiragana", completed: true },
      { name: "Learn Katakana", description: "Master katakana", completed: false, current: true },
      { name: "Basic Grammar", description: "N5 grammar", completed: false },
      { name: "500 Kanji", description: "Basic kanji", completed: false },
      { name: "Conversational Practice", description: "Basic conversations", completed: false },
      { name: "N4 Level", description: "Pass N4 practice", completed: false },
      { name: "N3 Preparation", description: "Study N3 material", completed: false },
    ],
  },
  {
    id: "4",
    goal: "Launch a Side Project",
    currentTask: "Today's Task Completed",
    progress: 55,
    currentMilestoneIndex: 3,
    summit: "Ship to Production",
    milestones: [
      { name: "Validate Idea", description: "Research concept", completed: true },
      { name: "Design MVP", description: "Wireframes and design", completed: true },
      { name: "Build Core Features", description: "Main functionality", completed: true },
      { name: "Beta Testing", description: "User feedback", completed: false, current: true },
      { name: "Iterate & Polish", description: "Fix and improve", completed: false },
      { name: "Launch", description: "Ship it", completed: false },
    ],
  },
  {
    id: "5",
    goal: "Read 24 Books This Year",
    currentTask: "Read Chapter 5 of Thinking Fast and Slow",
    progress: 38,
    currentMilestoneIndex: 2,
    summit: "Complete 24 Books",
    milestones: [
      { name: "6 Books", description: "First quarter", completed: true },
      { name: "12 Books", description: "Halfway", completed: true },
      { name: "18 Books", description: "Three quarters", completed: false, current: true },
      { name: "24 Books", description: "Complete challenge", completed: false },
    ],
  },
  {
    id: "6",
    goal: "Get Into Graduate School",
    currentTask: "No Task Today",
    progress: 20,
    currentMilestoneIndex: 1,
    summit: "Receive Admission Offer",
    milestones: [
      { name: "Research Programs", description: "Target schools", completed: true },
      { name: "Prepare GRE", description: "Study and take GRE", completed: false, current: true },
      { name: "Write Personal Statement", description: "Draft essay", completed: false },
      { name: "Get Recommendations", description: "Secure letters", completed: false },
      { name: "Submit Applications", description: "Apply", completed: false },
    ],
  },
];

export const patterns = [
  "Morning runs are more successful.",
  "Work stress affects consistency.",
  "Encouragement works better than pressure.",
  "Long runs have the highest skip rate.",
  "You perform best on weekends.",
];

export const risks: Risk[] = [
  {
    title: "Busy Work Schedule",
    detected: 5,
    impact: "High",
    suggestedFix: "Move long runs to Sunday",
  },
  {
    title: "Insufficient Recovery",
    detected: 3,
    impact: "Medium",
    suggestedFix: "Add one recovery day",
  },
];

export const strategicCards = [
  {
    number: "4.1",
    title: "Recommended Strategy",
    lines: [
      "Current Focus",
      "Consistency > Speed",
      "",
      "Reason",
      "Based on your progress, improving consistency will have a greater impact than adding interval training.",
    ],
  },
  {
    number: "4.2",
    title: "Skill Gap Analysis",
    lines: [
      "Goal",
      "Become an AI Product Designer",
      "",
      "Current Skills",
      "✓ UX Design",
      "✓ Figma",
      "✓ User Research",
      "",
      "Missing Skills",
      "✗ AI Product Thinking",
      "✗ Agent UX",
      "✗ AI Evaluation",
    ],
  },
  {
    number: "4.3",
    title: "Highest Leverage Actions",
    lines: [
      "Highest Leverage Action",
      "Build one complete AI Product case study.",
      "",
      "Expected Impact",
      "+25% portfolio quality",
      "",
      "Estimated Time",
      "20 hours",
    ],
  },
  {
    number: "4.4",
    title: "Bottleneck Analysis",
    lines: [
      "Current Bottleneck",
      "Not lack of knowledge.",
      "Not lack of tools.",
      "",
      "Main bottleneck:",
      "Insufficient project execution.",
    ],
  },
  {
    number: "4.5",
    title: "Opportunity Analysis",
    lines: [
      "Current Market Trends",
      "Most requested skills:",
      "",
      "1. Agent Design",
      "2. AI Evaluation",
      "3. Prompt Engineering",
      "4. AI Product Thinking",
    ],
  },
  {
    number: "4.6",
    title: "Trade-Off Analysis",
    lines: [
      "You have 10 hours this week.",
      "",
      "Option A",
      "Portfolio Project",
      "",
      "Impact: High",
      "Risk: Low",
      "",
      "Recommended",
    ],
  },
  {
    number: "4.7",
    title: "Scenario Planning",
    lines: [
      "If You Continue Current Pace",
      "Portfolio Ready: October",
      "",
      "If You Increase Weekly Hours",
      "Portfolio Ready: September",
      "",
      "If You Stop Building Projects",
      "Goal Delayed: 3-4 months",
    ],
  },
  {
    number: "4.8",
    title: "Mentor Insights",
    lines: [
      "Mentor Insight",
      "Many aspiring AI Product Designers spend too much time learning and too little time building.",
      "",
      "You appear ready for more execution.",
    ],
  },
];

export const chatMessages: ChatMessage[] = [
  {
    id: "1",
    role: "ai",
    content:
      "Hi Our system detected that your progression is faster than expected:\nYou completed Camp 2\n2 weeks ahead of schedule.\n\nBased on your recent performance,\nI recommend advancing to Camp 3.\n\nWould you like to:\n\nA. Keep current pace\n\nB. Advance to Camp 3\n\nC. Set a more ambitious goal",
    actions: [{ label: "Advance to Camp 3", id: "advance" }],
  },
  {
    id: "2",
    role: "ai",
    content:
      "This is the new plan for you.\n\nJune: text text text\n6/12 task\n6/13 task\n6/15 task\n\nJuly: text text text\n7/10 task\n7/15 task\n7/20 task\n\nGoal Completion day estimation: 7/31\n\nDoes it look good to you? Is there anything you would like to change?",
  },
];

export const sidebarMessages = [
  { label: "Progress Detection", hasNotification: true },
  { label: "Weekly Summary", hasNotification: false },
  { label: "Goal Update", hasNotification: false },
  { label: "Motivation Boost", hasNotification: false },
  { label: "Schedule Change", hasNotification: false },
];

export const sidebarChats = [
  "Suggestions",
  "Adjust Plans",
  "Training Tips",
  "Recovery Advice",
  "Race Day Prep",
  "Nutrition Guide",
  "Progress Review",
  "Goal Setting",
  "Weekly Reflection",
  "Monthly Review",
];

export const weekDays = [
  { day: "MON", date: 15, active: true },
  { day: "TUE", date: 16, active: true },
  { day: "WED", date: 17, active: false },
  { day: "THU", date: 18, active: true },
  { day: "FRI", date: 19, active: false },
  { day: "SAT", date: 20, active: true },
  { day: "SUN", date: 21, active: false },
];
