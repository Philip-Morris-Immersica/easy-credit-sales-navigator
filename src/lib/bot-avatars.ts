/**
 * Maps each bot key to its avatar image path (served from /public/avatars/).
 * Images are stock portraits matched to each persona's age, gender and type.
 */
export const BOT_AVATARS: Record<string, string> = {
  // Consultant (Роби — роботчето)
  consultant: "/robi.jpg",

  // Call scenarios
  "call-scenario-loyal": "/avatars/call-scenario-loyal.jpg",
  "call-scenario-preapproved": "/avatars/call-scenario-preapproved.jpg",
  "call-scenario-promo": "/avatars/call-scenario-promo.jpg",
  "call-scenario-pensioner": "/avatars/call-scenario-pensioner.jpg",
  "call-scenario-referral": "/avatars/call-scenario-referral.jpg",

  // Meeting scenarios
  "meeting-scenario-new": "/avatars/meeting-scenario-new.jpg",
  "meeting-scenario-existing-new": "/avatars/meeting-scenario-existing-new.jpg",
  "meeting-scenario-refinance": "/avatars/meeting-scenario-refinance.jpg",
  "meeting-scenario-home-visit": "/avatars/meeting-scenario-home-visit.jpg",
};

export function getBotAvatar(botKey: string): string | undefined {
  return BOT_AVATARS[botKey];
}
