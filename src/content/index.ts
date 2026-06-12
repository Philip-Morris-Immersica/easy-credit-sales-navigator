import type { NavigatorConfig } from "@/components/navigator/types";
import { callDirection, meetingDirection } from "@/content/sales-navigator/tree";

export const activeConfig: NavigatorConfig = {
  id: "sales-navigator",
  title: "Sales Navigator",
  theme: {
    id: "easy-credit",
    name: "Изи Кредит",
    logoRed: "/logo-red.svg",
    logoWhite: "/logo-white.svg",
  },
  directions: [callDirection, meetingDirection],
};
