const applicationId = process.env.DISCORD_APPLICATION_ID || "1526084195263447171";
const guildId = process.env.DISCORD_GUILD_ID || "";
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!botToken) {
  throw new Error("DISCORD_BOT_TOKEN is required.");
}

const dmCommandBase = {
  type: 1,
  contexts: [1],
  integration_types: [0],
};

const commands = [
  {
    ...dmCommandBase,
    name: "verify-pro",
    description: "DM-only Streamz Pro activation-code verification.",
    options: [
      {
        name: "code",
        description: "The 10-character Streamz Pro activation code from the PDF pass.",
        type: 3,
        required: true,
      },
    ],
  },
  {
    ...dmCommandBase,
    name: "code-expired",
    description: "DM-only expired Streamz Pro activation-code review.",
    options: [
      {
        name: "activation_pass",
        description: "Attach the original Streamz Pro Activation Pass PDF.",
        type: 11,
        required: true,
      },
    ],
  },
];

if (guildId) {
  const guildEndpoint = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;
  const guildResponse = await fetch(guildEndpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([]),
  });
  const guildData = await guildResponse.json().catch(() => ({}));
  if (!guildResponse.ok) {
    throw new Error(`Discord server command cleanup failed: ${guildResponse.status} ${JSON.stringify(guildData)}`);
  }
}

const globalEndpoint = `https://discord.com/api/v10/applications/${applicationId}/commands`;
const globalResponse = await fetch(globalEndpoint, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});

const globalData = await globalResponse.json().catch(() => ({}));
if (!globalResponse.ok) {
  throw new Error(`Discord DM command registration failed: ${globalResponse.status} ${JSON.stringify(globalData)}`);
}

console.log(`Registered Streamz Discord DM commands: ${globalData.map((command) => `/${command.name}`).join(", ")}`);
