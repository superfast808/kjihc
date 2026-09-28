export interface ConductSection {
  heading: string
  items: string[]
}

export const CODE_OF_CONDUCT_VERSION = "2026-1"

export const CODE_OF_CONDUCT_TITLE = "KJIHC Code of Conduct"

export const CODE_OF_CONDUCT: ConductSection[] = [
  {
    heading: "Players",
    items: [
      "Treat all coaches, teammates, opponents, and officials with respect at all times.",
      "Play and train with honesty and fair play; accept the decisions of officials without argument.",
      "Attend all training sessions and games as agreed; inform your coach as early as possible if you are unable to attend.",
      "Always wear the full approved protective equipment during ice time.",
      "Never engage in fighting, deliberate foul play, abusive language, or bullying — on or off the ice.",
      "Take pride in KJIHC colours; behave appropriately when representing the club at all venues and on social media.",
      "Look after club equipment and report any damage immediately.",
    ],
  },
  {
    heading: "Parents & Guardians",
    items: [
      "Encourage and support your child in a positive, constructive manner; celebrate effort as much as results.",
      "Treat all coaches, officials, players, and fellow parents with courtesy and respect at all times.",
      "Never attempt to coach from the rink side unless specifically asked by club staff.",
      "Respect and accept the decisions of referees and coaches — raise concerns privately and calmly after the event.",
      "Ensure your child attends ice time with all required safety equipment clean and in good repair.",
      "Keep monthly fees up to date via standing order; contact the treasurer promptly if you have any difficulties.",
      "Ensure all medical, dietary, and allergy information for your child is accurately recorded and kept up to date in the parent portal.",
      "Abide by the club's photography policy — only photograph your own child during closed sessions unless explicit permission is given.",
      "Ensure your contact details are always current in the parent portal so the club can reach you in an emergency.",
      "Do not attend ice time or club events if you have consumed alcohol.",
    ],
  },
  {
    heading: "KJIHC Club Commitments",
    items: [
      "Provide qualified, experienced coaches in a safe and welcoming environment.",
      "Treat all players, parents, and volunteers fairly regardless of ability, background, or circumstance.",
      "Apply disciplinary and welfare policies consistently and transparently.",
      "Notify parents promptly of any welfare, safeguarding, or significant operational matters.",
      "Maintain appropriate insurance and safeguarding measures at all times.",
    ],
  },
]

export const CONDUCT_SIGN_DECLARATION =
  "I confirm that I have read, understood, and agree to uphold the above standards on behalf of my child and myself. I understand that repeated or serious breaches may result in suspension or removal from the club."

/** Returns true if the given ISO timestamp is within the past 12 months */
export function isConductCurrent(codeSignedAt: string | null | undefined): boolean {
  if (!codeSignedAt) return false
  const signed = new Date(codeSignedAt)
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  return signed > oneYearAgo
}

export function conductSignedLabel(codeSignedAt: string | null | undefined): string {
  if (!codeSignedAt) return "Never signed"
  return `Signed ${new Date(codeSignedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
}
