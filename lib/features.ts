import { ACTIVITIES } from "./activities";
import { GUEST_DAYS } from "./guest-rules";
import { KIND_INFO } from "./kinds";
import { TEMPLATES } from "./templates";
import { THEME_IDS } from "./themes";

export interface Feature {
  icon: string;
  title: string;
  body: string;
  /** Small label, e.g. "With an account". */
  tag?: string;
}

/** "What you can do", shown beside the builder and the sign-in on the create page. Numbers come from the app itself. */
export function productFeatures({ ai }: { ai: boolean }): Feature[] {
  const list: Feature[] = [
    { icon: "📋", title: "Start from a template", body: `${TEMPLATES.map((t) => t.label).join(", ")}. Change anything you like.` },
    { icon: "🌳", title: `${ACTIVITIES.length} team activities`, body: "Motivation tree, Kudos wall, Sailboat retro and more. Everyone joins, in the room or online." },
    { icon: "🎛️", title: `${KIND_INFO.length} kinds of question`, body: "Score items, polls, quizzes, audience Q&A, word clouds and more. Add pictures to questions and options." },
    { icon: "🎨", title: `${THEME_IDS.length} slide designs`, body: "From plain to playful, dark to anime. Preview the big screen and a phone before you start." },
    { icon: "📈", title: "Live results", body: "Answers show up on your screen as people tap. Share the results to their phones if you like." },
  ];
  if (ai)
    list.push({
      icon: "✨",
      title: "AI insights",
      body: "Write questions from a short description, and sum up the whole presentation, question by question.",
      tag: "With a free account",
    });
  list.push(
    { icon: "📌", title: "Open points", body: "People raise follow-ups from their phones. Give each one to someone and track it until it's closed." },
    { icon: "📤", title: "Keep the results", body: "Download a PDF report with a short analysis, or a spreadsheet, or copy the results as text." },
    { icon: "🙌", title: "No sign-up needed", body: `Start as a guest; it lasts ${GUEST_DAYS} days. Your audience never needs an account or an app.` },
  );
  return list;
}
