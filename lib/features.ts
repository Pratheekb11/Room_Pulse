import type { StickerName } from "@/components/Sticker";
import { ACTIVITIES } from "./activities";
import { GUEST_DAYS } from "./guest-rules";
import { KIND_INFO } from "./kinds";
import { TEMPLATES } from "./templates";
import { THEME_IDS } from "./themes";

export interface Feature {
  /** Its sticker (components/Sticker.tsx). */
  icon: StickerName;
  title: string;
  /** A few words, for the home page. */
  short: string;
  /** The full line. */
  body: string;
  /** Small label, e.g. "With an account". */
  tag?: string;
}

/** "What you can do", on the home page (which shows the short lines). Numbers come from the app itself. */
export function productFeatures({ ai }: { ai: boolean }): Feature[] {
  const list: Feature[] = [
    { icon: "clipboard", title: "Start from a template", short: "Retro, standup, icebreaker, feedback", body: `${TEMPLATES.map((t) => t.label).join(", ")}. Change anything you like.` },
    { icon: "tree", title: `${ACTIVITIES.length} team activities`, short: "Tree, kudos wall, sailboat retro and more", body: "Motivation tree, Kudos wall, Sailboat retro and more. Everyone joins, in the room or online." },
    { icon: "cards", title: `${KIND_INFO.length} kinds of question`, short: "Polls, quizzes, Q&A, word clouds", body: "Score items, polls, quizzes, audience Q&A, word clouds and more. Add pictures to questions and options." },
    { icon: "palette", title: `${THEME_IDS.length} slide designs`, short: "Plain to playful, dark to anime", body: "From plain to playful, dark to anime. Preview the big screen and a phone before you start." },
    { icon: "bars", title: "Live results", short: "On your screen as people tap", body: "Answers show up on your screen as people tap. Share the results to their phones if you like." },
  ];
  if (ai)
    list.push({
      icon: "sparkle",
      title: "AI insights",
      short: "Questions and summaries written for you",
      body: "Write questions from a short description, and sum up the whole presentation, question by question.",
      tag: "With a free account",
    });
  list.push(
    { icon: "pin", title: "Open points", short: "Follow-ups, tracked until closed", body: "People raise follow-ups from their phones. Give each one to someone and track it until it's closed." },
    { icon: "download", title: "Keep the results", short: "PDF report, spreadsheet or text", body: "Download a PDF report with a short analysis, or a spreadsheet, or copy the results as text." },
    { icon: "phone", title: "No sign-up needed", short: "Your audience needs no app", body: `Start as a guest; it lasts ${GUEST_DAYS} days. Your audience never needs an account or an app.` },
  );
  return list;
}
