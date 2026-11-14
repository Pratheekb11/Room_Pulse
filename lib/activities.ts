// Team activities: ready-made team-building games that work for people in the room and online
// alike, built from the usual question types. Each one turns on results on phones, so everyone
// watches the tree (or wall, or sky) fill up together.
import { planToBody, type PresentationPlan } from "./templates";

export interface Activity {
  id: string;
  label: string;
  /** An emoji for the card. */
  icon: string;
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
    icon: "🌳",
    label: "Motivation tree",
    blurb: "Everyone adds a leaf: what keeps them going at work",
    minutes: 15,
    steps: [
      "Show the QR code. Everyone joins, in the room or online.",
      "Give people 3 minutes to write their leaf. Signing it is optional.",
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
          description: "Write it on your leaf. Add your name if you like.",
        },
      ],
    },
  },
  {
    id: "goals-sky",
    icon: "✨",
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
        { kind: "text", board: "sky", name: "One goal you want to reach next year", description: "Big or small. Sign it if you like." },
        { kind: "text", board: "wall", name: "What would help you get there?" },
      ],
    },
  },
  {
    id: "kudos-wall",
    icon: "💌",
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
        { kind: "text", board: "wall", name: "Who helped you lately, and how?", description: "Name them in your note. Sign it or stay anonymous." },
      ],
    },
  },
  {
    id: "sailboat",
    icon: "⛵",
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
    icon: "🌦️",
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
    icon: "🦸",
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
        { kind: "text", board: "sky", name: "What's a skill of yours the team might not know about?", description: "Sign it, so people know who to ask." },
        { kind: "words", name: "One thing you'd love to learn" },
      ],
    },
  },
  {
    id: "this-or-that",
    icon: "⚖️",
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
    icon: "💬",
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
    icon: "🤝",
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
];

/** The create-presentation request for an activity: results are on phones from the start. */
export function activityToBody(a: Activity) {
  return { ...planToBody(a.plan), showResults: true };
}
