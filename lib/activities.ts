import type { StickerName } from "@/components/Sticker";
// Team activities: ready-made team-building games that work for people in the room and online
// alike, built from the usual question types. Each one turns on results on phones, so everyone
// watches the tree (or wall, or sky) fill up together.
import { planToBody, type PresentationPlan } from "./templates";

export interface Activity {
  id: string;
  label: string;
  /** An emoji for the card. */
  /** Its sticker (components/Sticker.tsx). */
  icon: StickerName;
  /** One line under the label. */
  blurb: string;
  /** Roughly how long it takes, in minutes. */
  minutes: number;
  /** How to run it, for the host. */
  steps: string[];
  plan: PresentationPlan;
}

export const ACTIVITIES: Activity[] = [
  {
    id: "motivation-tree",
    icon: "tree",
    label: "Motivation tree",
    blurb: "Everyone adds a leaf: what keeps them going at work",
    minutes: 15,
    steps: [
      "Show the QR code. Everyone joins, in the room or online.",
      "Give people 3 minutes to write their leaf. Each leaf shows its writer's name.",
      "Watch the tree grow. Tap a leaf to show it big, and talk about it.",
      "Ask: what do many of us share? What surprised you?",
    ],
    plan: {
      title: "Our motivation tree",
      questions: [
        {
          kind: "text",
          board: "tree",
          name: "What motivates you at work?",
          description: "Write it on your leaf. Your name goes on it.",
        },
      ],
    },
  },
  {
    id: "goals-sky",
    icon: "star",
    label: "Goals for next year",
    blurb: "Each goal lights up a star; then what would help",
    minutes: 20,
    steps: [
      "Everyone writes one goal for next year. It becomes a star.",
      "Read a few stars out. Group the ones that point the same way.",
      "Then ask what support would help, and agree on one or two.",
    ],
    plan: {
      title: "Our goals for next year",
      questions: [
        { kind: "text", board: "sky", name: "One goal you want to reach next year", description: "Big or small." },
        { kind: "text", board: "wall", name: "What would help you get there?" },
      ],
    },
  },
  {
    id: "kudos-wall",
    icon: "kudos",
    label: "Kudos wall",
    blurb: "Thank a teammate on a sticky note",
    minutes: 10,
    steps: [
      "Ask everyone to thank one person for something specific.",
      "Read the wall out loud at the end. It's a nice way to close a sprint.",
    ],
    plan: {
      title: "Kudos wall",
      questions: [
        { kind: "text", board: "wall", name: "Who helped you lately, and how?", description: "Name them in your note." },
      ],
    },
  },
  {
    id: "sailboat",
    icon: "boat",
    label: "Sailboat retro",
    blurb: "Wind, anchors, rocks and the island we sail to",
    minutes: 30,
    steps: [
      "Explain the picture: we're a boat sailing to an island.",
      "Go through the four parts one at a time, 3 minutes each.",
      "Talk about the anchors and rocks, and raise open points for the big ones.",
    ],
    plan: {
      title: "Sailboat retro",
      questions: [
        { kind: "text", board: "wall", name: "Wind: what pushed us forward?" },
        { kind: "text", board: "wall", name: "Anchor: what held us back?" },
        { kind: "text", board: "wall", name: "Rocks: what risks are ahead?" },
        { kind: "text", board: "wall", name: "Island: where do we want to get to?" },
      ],
    },
  },
  {
    id: "weather",
    icon: "weather",
    label: "Weather check-in",
    blurb: "How's everyone's weather today? A gentle start",
    minutes: 5,
    steps: [
      "Everyone picks their weather. No need to explain.",
      "If there's a storm or two, offer to talk after the meeting.",
    ],
    plan: {
      title: "Weather check-in",
      questions: [
        { kind: "poll", name: "What's your weather today?", options: ["☀️ Sunny", "⛅ A few clouds", "🌧️ Rainy", "⛈️ Stormy"] },
        { kind: "text", board: "wall", name: "Anything the team should know today?", description: "Optional." },
      ],
    },
  },
  {
    id: "superpowers",
    icon: "bolt",
    label: "Hidden superpowers",
    blurb: "Skills the team doesn't know about yet",
    minutes: 15,
    steps: [
      "Everyone shares a skill the team might not know they have, signed.",
      "Pick a few to ask about. You may find your next workshop host.",
    ],
    plan: {
      title: "Hidden superpowers",
      questions: [
        { kind: "text", board: "sky", name: "What's a skill of yours the team might not know about?", description: "Your name goes on it, so people know who to ask." },
        { kind: "words", name: "One thing you'd love to learn" },
      ],
    },
  },
  {
    id: "this-or-that",
    icon: "scales",
    label: "This or that",
    blurb: "Quick fun picks to warm up a meeting",
    minutes: 5,
    steps: ["Go through the questions quickly and laugh at the splits.", "Ask one person from the smaller side to defend it."],
    plan: {
      title: "This or that",
      questions: [
        { kind: "poll", name: "Coffee or tea?", options: ["☕ Coffee", "🍵 Tea"] },
        { kind: "poll", name: "Beach or mountains?", options: ["🏖️ Beach", "🏔️ Mountains"] },
        { kind: "poll", name: "Early bird or night owl?", options: ["🐦 Early bird", "🦉 Night owl"] },
        { kind: "poll", name: "Call or chat?", options: ["📞 Call", "💬 Chat"] },
      ],
    },
  },
  {
    id: "team-word",
    icon: "bubble",
    label: "Our team in one word",
    blurb: "A word cloud of who we are, and who we want to be",
    minutes: 10,
    steps: ["Everyone gives up to three words for the team today.", "Then the same for a year from now, and compare the clouds."],
    plan: {
      title: "Our team in one word",
      questions: [
        { kind: "words", name: "Describe our team today in a word" },
        { kind: "words", name: "And a year from now?" },
      ],
    },
  },
  {
    id: "team-agreements",
    icon: "pact",
    label: "Team agreements",
    blurb: "Agree how we work together best",
    minutes: 20,
    steps: [
      "Everyone writes one thing that helps the team work well.",
      "Group similar notes, then vote on the ones to keep as team agreements.",
    ],
    plan: {
      title: "How we work together",
      questions: [
        { kind: "text", board: "wall", name: "One thing that helps us work well together" },
        { kind: "text", board: "wall", name: "One thing that gets in our way" },
      ],
    },
  },
  {
    id: "two-truths",
    icon: "cards",
    label: "Two truths and a lie",
    blurb: "Three facts each, one made up: can the team spot it?",
    minutes: 20,
    steps: [
      "Everyone writes three short notes about themselves: two true, one made up. Their name goes on them.",
      "Pick a person. Read their three notes out in the order they appear on the wall: the first, the second, the third.",
      "Everyone guesses the lie in the next question. Then the person tells the room which one it was.",
      "Do as many people as you have rounds. To play more, edit the presentation and add another round.",
    ],
    plan: {
      title: "Two truths and a lie",
      questions: [
        {
          kind: "text",
          board: "wall",
          maxLeaves: 3,
          name: "Two truths and a lie about you",
          description: "Three notes: two true, one made up. Keep them short.",
        },
        { kind: "poll", name: "Round 1: which one is the lie?", options: ["The first", "The second", "The third"] },
        { kind: "poll", name: "Round 2: which one is the lie?", options: ["The first", "The second", "The third"] },
        { kind: "poll", name: "Round 3: which one is the lie?", options: ["The first", "The second", "The third"] },
        { kind: "poll", name: "Round 4: which one is the lie?", options: ["The first", "The second", "The third"] },
      ],
    },
  },
  {
    id: "gratitude-jar",
    icon: "jar",
    label: "Gratitude jar",
    blurb: "Small things we're thankful for, one note each",
    minutes: 10,
    steps: [
      "Ask everyone to add something they're thankful for this week: a person, a moment, a small win.",
      "Read a few notes out. No need to discuss: just let them land.",
      "End the meeting on it. It works well before a holiday or after a hard sprint.",
    ],
    plan: {
      title: "Our gratitude jar",
      questions: [
        { kind: "text", board: "wall", name: "Something you're thankful for this week", description: "Big or small, at work or not." },
      ],
    },
  },
  {
    id: "time-capsule",
    icon: "capsule",
    label: "Time capsule",
    blurb: "Hopes and guesses for the year, to open together next year",
    minutes: 15,
    steps: [
      "Everyone writes a message to the team a year from now: a hope, a guess, a worry.",
      "Then one word for how this year felt.",
      "Download the report (PDF) when you're done and keep it somewhere safe.",
      "Put a date in the calendar for next year, and open the capsule together.",
    ],
    plan: {
      title: "Our time capsule",
      questions: [
        { kind: "text", board: "wall", name: "A message to our team a year from now", description: "A hope, a guess or a worry. We'll read it next year." },
        { kind: "words", name: "This year in one word" },
      ],
    },
  },
  {
    id: "team-map",
    icon: "pin",
    label: "Team map",
    blurb: "Where everyone joins from, in one cloud",
    minutes: 5,
    steps: [
      "Ask everyone where they're joining from today: a city, a town, or just \"home\".",
      "Look at the cloud: the big words are where most of us are.",
      "Ask the people furthest away what the weather's like there.",
    ],
    plan: {
      title: "Our team map",
      questions: [
        { kind: "words", name: "Where are you joining from today?", description: "Your city or town." },
        { kind: "words", name: "One place you'd love to work from for a week" },
      ],
    },
  },
  {
    id: "bucket-list",
    icon: "sparkle",
    label: "Bucket list",
    blurb: "Things we'd love to do one day, as stars",
    minutes: 15,
    steps: [
      "Everyone adds things they'd love to do one day. Each one becomes a star with their name.",
      "Tap a few stars and ask the person to tell the story behind it.",
      "Look for ones you could do together as a team.",
    ],
    plan: {
      title: "Our bucket list",
      questions: [
        { kind: "text", board: "sky", maxLeaves: 3, name: "Something you'd love to do one day", description: "Up to three. Dream big." },
      ],
    },
  },
];

/** The create-presentation request for an activity: results are on phones from the start. */
export function activityToBody(a: Activity) {
  return { ...planToBody(a.plan), showResults: true };
}

/**
 * The activity a presentation was made from, matched by its title (the plan's title, exactly as made),
 * so the results screen can show the host how to run it. Null if the title was changed or it's not one.
 */
export function activityFor(title: string): Activity | null {
  return ACTIVITIES.find((a) => a.plan.title === title.trim()) ?? null;
}
