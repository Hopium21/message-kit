#!/usr/bin/env node
import { program } from "commander";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { log, outro, text, select } from "@clack/prompts";
import { default as fs } from "fs-extra";
import { isCancel } from "@clack/prompts";
import { detect } from "detect-package-manager";
import pc from "picocolors";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read package.json to get the version
const packageJson = JSON.parse(
  fs.readFileSync(resolve(__dirname, "package.json"), "utf8"),
);
const version = packageJson.version;
program
  .name("message-kit")
  .description("CLI to initialize projects")
  .action(async () => {
    // Add Yarn 4 check at the start of the action
    const pkgManager = await detectPackageManager();

    log.info(pc.cyan(`pkgManager detected: ${pkgManager}`));

    log.info(pc.cyan(`Welcome to MessageKit CLI v${version}!`));
    const coolLogo = `
███╗   ███╗███████╗███████╗███████╗ █████╗  ██████╗ ███████╗██╗  ██╗██╗████████╗
████╗ ████║██╔════╝██╔════╝██╔════╝██╔══██╗██╔════╝ ██╔════╝██║ ██╔╝██║╚══██╔══╝
██╔████╔██║█████╗  ███████╗███████╗███████║██║  ███╗█████╗  █████╔╝ ██║   ██║   
██║╚██╔╝██║██╔══╝  ╚════██║╚════██║██╔══██║██║   ██║██╔══╝  ██╔═██╗ ██║   ██║   
██║ ╚═╝ ██║███████╗███████║███████║██║  ██║╚██████╔╝███████╗██║  ██╗██║   ██║   
╚═╝     ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝   
Powered by XMTP`;

    log.info(pc.red(coolLogo));

    const { templateType, displayName, destDir } = await gatherProjectInfo();

    // Create .gitignore
    createGitignore(destDir);

    // Create .env file
    createEnvFile(destDir);

    // Create tsconfig.json file
    createTsconfig(destDir);

    // Wrap up
    log.success(`Project launched in ${pc.red(destDir)}!`);

    // Add package.json
    addPackagejson(destDir, displayName, pkgManager);

    // Create README.md file
    createReadme(destDir, templateType, displayName, pkgManager);

    // Log next steps
    logNextSteps(displayName);

    outro(pc.red("Made with ❤️  by Ephemera"));
  });

program.parse(process.argv);

async function addPackagejson(destDir, name, pkgManager) {
  // Create package.json based on the template
  let packageTemplate = {
    name: name,
    private: true,
    type: "module",
    scripts: {
      build: "tsc",
      dev: "tsc -w & sleep 1 && node --watch dist/index.js",
      start: "node dist/index.js",
      postinstall: "tsc",
    },
    dependencies: {
      "@xmtp/message-kit": "latest",
    },
    engines: {
      node: ">=20",
    },
  };

  if (pkgManager.startsWith("yarn")) {
    packageTemplate.packageManager = `${pkgManager}`;
    // Add .yarnrc.yml to disable PnP mode
    fs.writeFileSync(
      resolve(destDir, ".yarnrc.yml"),
      "nodeLinker: node-modules\n",
    );
  }
  fs.writeJsonSync(resolve(destDir, "package.json"), packageTemplate, {
    spaces: 2,
  });
}

async function gatherProjectInfo() {
  const templateOptions = [
    { value: "gm", label: "GM" },
    { value: "agent", label: "Agent" },
    { value: "group", label: "Group" },
  ];

  const templateType = await select({
    message: "Select the type of template to initialize:",
    options: templateOptions,
  });

  if (isCancel(templateType)) {
    process.exit(0);
  }

  const templateDir = resolve(__dirname, `./templates/${templateType}`);

  // Ensure the template directory exists
  if (!fs.existsSync(templateDir)) {
    console.error("Template directory does not exist.");
    process.exit(1);
  }

  const displayName = await text({
    message: "What is the name of the project to initialize?",
    validate(value) {
      if (!value) return "Please enter a name.";
      return;
    },
  });

  if (isCancel(displayName)) {
    process.exit(0);
  }

  const name = kebabcase(displayName);
  const destDir = resolve(process.cwd(), name);

  // Copy template files
  fs.copySync(templateDir, destDir);

  return { templateType, displayName, destDir, templateDir };
}

function createTsconfig(destDir) {
  const tsconfigContent = {
    include: ["src/**/*"],
    compilerOptions: {
      outDir: "./dist",
      esModuleInterop: true,
      declaration: true,
      declarationMap: true,
      forceConsistentCasingInFileNames: true,
      isolatedModules: true,
      lib: ["ESNext"],
      module: "ESNext",
      moduleResolution: "node",
      resolveJsonModule: true,
      skipLibCheck: true,
      sourceMap: true,
      strict: true,
      target: "ESNext",
    },
  };

  fs.writeJsonSync(resolve(destDir, "tsconfig.json"), tsconfigContent, {
    spaces: 2,
  });
}

function logNextSteps(name) {
  log.message("Next steps:");
  log.step(`1. ${pc.red(`cd ./${name}`)} - Navigate to project`);
  log.step(`2. ${pc.red(`code .`)} - Open with your favorite editor`);
  log.step(`3. ${pc.green("Start building!")}`);
}
function createGitignore(destDir) {
  const gitignoreContent = `
# Main
.env
node_modules/
.data/
dist/
.DS_Store

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE files
.vscode/
.idea/

# packages
.yarn/
.pnpm/
.pnpm-workspace/`;

  fs.writeFileSync(resolve(destDir, ".gitignore"), gitignoreContent.trim());
}

async function detectPackageManager() {
  try {
    const pkgManager = await detect();
    const userAgent = process.env.npm_config_user_agent;
    let version = "";

    if (userAgent && pkgManager === "yarn") {
      const parts = userAgent.split(" ")[0]?.split("/");
      if (parts && parts.length > 1) {
        version = `@${parts[1]}`;
      }
    }

    return pkgManager + version;
  } catch (error) {
    // Fallback to npm if detection fails
    return "npm";
  }
}

function kebabcase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function createEnvFile(destDir) {
  fs.writeFileSync(resolve(destDir, ".env"), "");
}

// Create README.md file
function createReadme(destDir, templateType, projectName, packageManager) {
  const envExampleContent = fs.readFileSync(
    resolve(destDir, ".env.example"),
    "utf8",
  );

  const readmeContent = `# ${projectName}

This project is powered by [MessageKit](https://messagekit.ephemerahq.com/) 

## Setup

Follow these steps to set up and run the project:

1. **Navigate to the project directory:**

\`\`\`sh
cd ./${projectName}
\`\`\`

2. **Set up your environment variables:**

\`\`\`sh
${envExampleContent}
\`\`\`

3. **Install dependencies:**

\`\`\`sh
${packageManager} install
\`\`\`

4. **Run the project:**

\`\`\`sh
${packageManager === "npm" ? "npm run" : packageManager} dev
\`\`\`

5. Enjoy!
---
Made with ❤️ by [XMTP](https://xmtp.org)
`;

  fs.writeFileSync(resolve(destDir, "README.md"), readmeContent.trim());
}
