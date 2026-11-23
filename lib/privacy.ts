// What LiveRate keeps, in plain words: the /privacy page and the home page footer line (test/privacy.test.ts).
// Keep it true: when a feature starts storing something new, or a retention period changes, change this too.
import { GUEST_DAYS } from "./guest-rules";

export const PRIVACY_CONTACT = "bpratheek633@gmail.com";
export const PRIVACY_UPDATED = "23 November 2026";

/** The home page footer's line (the link to /privacy sits beside it). */
export const FOOTER_PRIVACY = "Answers are anonymous unless the presenter asks for names.";

/** Outside services that see LiveRate's data. Add Resend once sign-up emails are switched on in production. */
export const SERVICES: { name: string; what: string }[] = [
  { name: "Vercel", what: "hosts the site, and counts page visits with Vercel Analytics (no cookies)." },
  { name: "Neon", what: "stores the database." },
  { name: "Google Gemini", what: "only when a presenter turns on AI insights (see above)." },
];

export type PrivacySection = { heading: string; body: string[]; list?: string[] };

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    heading: "If you answer questions",
    body: [
      "You don't need an account. Your phone gets a random ID the first time you join. It isn't linked to your name, phone number or email. It lets us keep your answers together and stop one phone answering twice.",
      "What we keep: the answers you give (scores, picks, typed answers, questions you ask, upvotes and open points you raise).",
      "Names: answers are anonymous unless the presenter asks for names. If they do, your phone asks for a name before the first question and says so at the top of the screen. Some activities, like the tree, always show the writer's name next to their answer, and quiz nicknames show on the leaderboard. A name can be anything you choose; it doesn't have to be your real one.",
      "Be careful what you type. The presenter, and anyone looking at the big screen, can read typed answers. Don't type anything you wouldn't say in the room.",
      "Who sees your answers: the presenter sees them all and can download them. If the presenter shares results, other people in the session see them too. The presenter can hide answers from the big screen.",
    ],
  },
  {
    heading: "If you make presentations",
    body: [
      "What we keep: your email and a scrambled form of your password (we can't read your password), the presentations you make, the pictures you upload and the answers they collect.",
      `Guest accounts need no email. A guest account and its presentations are deleted automatically ${GUEST_DAYS} days after they were made.`,
      "Saved accounts keep their presentations until you delete them. Deleting a presentation, or using “Clear all answers”, removes its answers straight away. Uploaded pictures go at the next daily clean-up.",
      "Your part: you decide what to ask and what to do with the answers. If you collect names or anything sensitive, tell the people in the room.",
    ],
  },
  {
    heading: "AI features",
    body: [
      "Only if the presenter turns on AI insights: typed answers and Q&A questions are sent to Google's Gemini to write summaries. Hidden answers are never sent. Google's free tier may use what's sent to improve its products, so don't use AI on presentations with sensitive answers.",
    ],
  },
  {
    heading: "Stopping abuse",
    body: [
      "To stop floods of fake answers and password guessing, we keep a scrambled form of your IP address (it can't be turned back into the address) with a count of requests. These counts are deleted after one day. Wrong-password counts are kept to lock out repeated guessing.",
    ],
  },
  {
    heading: "What stays on your device",
    body: [
      "Your browser keeps your random ID, your answers so far, the name you entered and a few settings, so a refresh doesn't lose them. Presenters get a sign-in cookie. We don't use advertising or tracking cookies.",
    ],
  },
  {
    heading: "Services we use",
    body: ["We don't sell your data or use it for advertising."],
    list: SERVICES.map((s) => `${s.name}: ${s.what}`),
  },
  {
    heading: "Who can look at the data",
    body: ["We only look at presentations or answers to fix a problem, when you ask us for help, or when the law requires it."],
  },
  {
    heading: "Your choices",
    body: [
      "Answer anonymously, or with a made-up name. Presenters can delete any presentation and its answers at any time.",
      "To have something deleted, or to ask what we hold about you, email us. If you answered anonymously, tell us the presentation code and what you wrote, because otherwise we can't tell which answers are yours.",
    ],
  },
  {
    heading: "Children",
    body: ["LiveRate isn't meant for children under 18 without a parent's or school's permission."],
  },
  {
    heading: "Changes",
    body: ["If this page changes, we'll update the date at the top."],
  },
];
