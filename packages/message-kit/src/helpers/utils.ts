import path from "path";
import { SkillGroup, SkillCommand } from "./types";
import { Client } from "@xmtp/node-sdk";
import { Config } from "./types";

export function extractCommandValues(
  text: string,
  skills: SkillGroup[],
): {
  command: string | undefined;
  params: { [key: string]: string | number | string[] | undefined };
} {
  if (!text.startsWith("/")) return { command: undefined, params: {} };

  const defaultResult = {
    command: undefined,
    params: {} as { [key: string]: string | number | string[] | undefined },
  };
  try {
    if (typeof text !== "string") return defaultResult;

    // Replace all "“" and "”" with "'" and '"'
    text = text.toLowerCase().replaceAll("“", '"').replaceAll("”", '"');

    const parts = text.match(/[^\s"']+|"([^"]*)"|'([^']*)'|`([^`]*)`/g);
    if (!parts) return defaultResult;

    let commandName = parts[0].startsWith("/") ? parts[0].slice(1) : parts[0];
    let commandConfig: SkillCommand | undefined = undefined;

    for (const group of skills) {
      commandConfig = group.skills.find((cmd) =>
        cmd.command.startsWith(`/${commandName}`),
      );
      if (commandConfig) break;
    }

    if (!commandConfig) return defaultResult;

    const values: {
      command: string;
      params: { [key: string]: string | number | string[] | undefined };
    } = {
      command: commandName,
      params: {},
    };
    const expectedParams = commandConfig.params || {};
    const usedIndices = new Set();

    for (const [param, paramConfig] of Object.entries(expectedParams)) {
      const {
        type,
        values: possibleValues = [],
        plural = false,
        default: defaultValue,
      } = paramConfig;

      let valueFound = false;
      // Handle string type with no possible values
      if (type === "string" && possibleValues.length === 0) {
        const stringIndex = parts.findIndex(
          (part, idx) => !usedIndices.has(idx) && idx > 0,
        );
        if (stringIndex !== -1) {
          values.params[param] = parts[stringIndex];
          usedIndices.add(stringIndex);
          valueFound = true;
        }
      } else if (type === "quoted") {
        const quotedIndex = parts.findIndex(
          (part, idx) => /^["'`].*["'`]$/.test(part) && !usedIndices.has(idx),
        );
        if (quotedIndex !== -1) {
          values.params[param] = parts[quotedIndex].slice(1, -1);
          usedIndices.add(quotedIndex);
          valueFound = true;
        }
      } else if (type === "url") {
        const urlIndex = parts.findIndex(
          (part, idx) => /^https?:\/\//.test(part) && !usedIndices.has(idx),
        );
        if (urlIndex !== -1) {
          values.params[param] = parts[urlIndex];
          usedIndices.add(urlIndex);
          valueFound = true;
        }
      } else if (type === "prompt") {
        values.params[param] = parts.slice(1).join(" ");
        valueFound = true;
      } else if (type === "username") {
        // Updated regular expression to ensure usernames start with @
        const usernameParts = parts.reduce<string[]>((acc, part, idx) => {
          if (
            !usedIndices.has(idx) &&
            (/^@[a-zA-Z][a-zA-Z0-9_-]*$/.test(part) ||
              /^[a-zA-Z0-9-]+\.eth$/.test(part)) // Ensure it starts with @ or is a .eth domain
          ) {
            usedIndices.add(idx);
            // Handle potential comma-separated values
            const usernames = part.split(",");
            acc.push(...usernames);
          }
          return acc;
        }, []);

        if (usernameParts.length > 0) {
          values.params[param] = plural ? usernameParts : usernameParts[0];
          valueFound = true;
        }
      } else if (type === "address") {
        // Handle comma-separated addresses
        const addressParts = parts.reduce<string[]>((acc, part, idx) => {
          if (!usedIndices.has(idx) && /^0x[a-fA-F0-9]{40}$/.test(part)) {
            usedIndices.add(idx);
            const addresses = part.split(",").map((a) => a.trim());
            acc.push(...addresses);
          }
          return acc;
        }, []);

        if (addressParts.length > 0) {
          values.params[param] =
            addressParts.length === 1 ? addressParts[0] : addressParts;
          valueFound = true;
        }
      } else if (type === "number") {
        // Handle comma-separated numbers
        const numberParts = parts.reduce<number[]>((acc, part, idx) => {
          if (!usedIndices.has(idx) && !isNaN(parseFloat(part))) {
            usedIndices.add(idx);
            const numbers = part
              .split(",")
              .map((n) => parseFloat(n.trim()))
              .filter((n) => !isNaN(n));
            acc.push(...numbers);
          }
          return acc;
        }, []);

        if (numberParts.length > 0) {
          //@ts-ignore
          values.params[param] =
            numberParts.length === 1 ? numberParts[0] : numberParts;
          valueFound = true;
        }
      } else if (possibleValues.length > 0) {
        const index = parts.findIndex(
          (part, idx) =>
            possibleValues.includes(part.toLowerCase()) &&
            !usedIndices.has(idx),
        );
        if (index !== -1) {
          values.params[param] = parts[index];
          usedIndices.add(index);
          valueFound = true;
        }
      }
      // If no value was found, set the default value if it exists
      if (!valueFound && defaultValue !== undefined) {
        //@ts-ignore
        values.params[param] = defaultValue;
      }
    }

    return values;
  } catch (e) {
    console.error(e);
    return defaultResult;
  }
}

export async function loadSkillsFile(
  configPath: string = "skills.js",
): Promise<SkillGroup[]> {
  const resolvedPath = path.resolve(process.cwd(), "dist/" + configPath);
  let skills: SkillGroup[] = [];
  try {
    const module = await import(resolvedPath);
    skills = module?.skills;
  } catch (error) {
    // if (process.env.MSG_LOG === "true")
    //   console.error(`Error loading command config from ${resolvedPath}:`);
  }
  if (skills === undefined || skills?.length === 0) return [];
  return skills;
}
export const shorterLogMessage = (message: string) => {
  return message?.substring(0, 60) + (message?.length > 60 ? "..." : "");
};

export const logMessage = (message: string) => {
  if (process.env.MSG_LOG === "false") return;
  console.log(shorterLogMessage(message));
};

export async function logInitMessage(client: Client, config?: Config) {
  const coolLogo = `\x1b[38;2;250;105;119m\
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

███╗   ███╗███████╗███████╗███████╗ █████╗  ██████╗ ███████╗██╗  ██╗██╗████████╗
████╗ ████║██╔════╝██╔════╝██╔════╝██╔══██╗██╔════╝ ██╔════╝██║ ██╔╝██║╚══██╔══╝
██╔████╔██║█████╗  ███████╗███████╗███████║██║  ███╗█████╗  █████╔╝ ██║   ██║   
██║╚██╔╝██║██╔══╝  ╚════██║╚════██║██╔══██║██║   ██║██╔══╝  ██╔═██╗ ██║   ██║   
██║ ╚═╝ ██║███████╗███████║███████║██║  ██║╚██████╔╝███████╗██║  ██╗██║   ██║   
╚═╝     ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝   
Powered by XMTP \x1b[0m`;
  console.log(coolLogo);
  console.log(`
    Send a message to this account on Converse:                              
    🔗 https://converse.xyz/dm/${client.accountAddress}`);

  const skills = await loadSkillsFile();
  if (
    config?.experimental ||
    config?.attachments ||
    config?.memberChange ||
    skills?.length === 0
  ) {
    console.warn(`\x1b[33m
    Warnings:`);
    if (config?.attachments) {
      console.warn("\t- ⚠️ Attachments are enabled");
    }
    if (config?.client?.logging) {
      console.warn(`\t- ⚠️ Logging is set to ${config.client.logging}`);
    }
    if (config?.privateKey) {
      console.warn("\t- ⚠️ Private key is set from the code");
    }
    if (config?.memberChange) {
      console.warn("\t- ⚠️ Member changes are enabled");
    }
    if (config?.skillsConfigPath) {
      console.warn(
        `\t- ⚠️ Skills config path is set to ${config.skillsConfigPath}`,
      );
    }
    if (skills === undefined || skills?.length === 0) {
      console.warn("\t- ⚠️ No skills.ts file found or wrongly formatted");
    }
    if (config?.experimental) {
      console.warn(
        `\t- ☣️ EXPERIMENTAL MODE ENABLED:
        \t\t⚠️ All group messages will be exposed — proceed with caution.
        \t\tℹ Guidelines: https://messagekit.ephemerahq.com/guidelines`,
      );
    }
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Logging new messages to console ↴`);
}