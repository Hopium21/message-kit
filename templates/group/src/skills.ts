import { handler as tipping } from "./handler/tipping.js";
import { handler as payment } from "./handler/payment.js";
import { handler as games } from "./handler/game.js";
import { handler as help } from "./handler/helpers.js";
import type { SkillGroup } from "@xmtp/message-kit";

export const skills: SkillGroup[] = [
  {
    name: "Group bot",
    tag: "@bot",
    description: "Group agent for tipping and transactions.",
    skills: [
      {
        skill: "/tip [usernames] [amount] [token]",
        triggers: ["/tip"],
        examples: ["/tip @vitalik 10 usdc"],
        description: "Tip users in a specified token.",
        handler: tipping,
        params: {
          username: {
            default: "",
            plural: true,
            type: "username",
          },
          amount: {
            default: 10,
            type: "number",
          },
        },
      },
      {
        skill: "/pay [amount] [token] [username]",
        triggers: ["/pay"],
        examples: ["/pay 10 vitalik.eth"],
        description:
          "Send a specified amount of a cryptocurrency to a destination address.",
        handler: payment,
        params: {
          amount: {
            default: 10,
            type: "number",
          },
          token: {
            default: "usdc",
            type: "string",
            values: ["eth", "dai", "usdc", "degen"], // Accepted tokens
          },
          username: {
            default: "",
            type: "username",
          },
        },
      },
      {
        skill: "/game [game]",
        triggers: ["/game", "🔎", "🔍"],
        handler: games,
        description: "Play a game.",
        examples: ["/game wordle", "/game slot", "/game help"],
        params: {
          game: {
            default: "",
            type: "string",
            values: ["wordle", "slot", "help"],
          },
        },
      },
      {
        skill: "/help",
        triggers: ["/help"],
        examples: ["/help"],
        handler: help,
        description: "Get help with the bot.",
        params: {},
      },
      {
        skill: "/id",
        adminOnly: true,
        examples: ["/id"],
        handler: help,
        triggers: ["/id"],
        description: "Get the group ID.",
        params: {},
      },
    ],
  },
];
