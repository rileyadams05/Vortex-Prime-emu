const applicationId = process.env.DISCORD_APPLICATION_ID || "1526084195263447171";
const guildId = process.env.DISCORD_GUILD_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!guildId) {
  throw new Error("DISCORD_GUILD_ID is required.");
}

if (!botToken) {
  throw new Error("DISCORD_BOT_TOKEN is required.");
}

const verifyProCommand = {
  name: "verify-pro",
  description: "Privately verify a paid Streamz Pro purchase.",
  type: 1,
  options: [
    {
      name: "code",
      description: "Your 10-character Streamz Pro activation code from the PDF pass.",
      type: 3,
      required: true,
    },
  ],
};

const supportCommand = {
  name: "support",
  description: "Open a private Streamz Pro support request using your original activation-pass PDF.",
  type: 1,
  contexts: [1],
  integration_types: [0],
  options: [
    {
      name: "description",
      description: "Briefly describe the problem.",
      type: 3,
      required: true,
    },
    {
      name: "activation_pass",
      description: "Attach the original Streamz Pro Activation Pass PDF.",
      type: 11,
      required: true,
    },
  ],
};

const guildEndpoint = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;
const guildResponse = await fetch(guildEndpoint, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify([verifyProCommand]),
});

const guildData = await guildResponse.json().catch(() => ({}));
if (!guildResponse.ok) {
  throw new Error(`Discord guild command registration failed: ${guildResponse.status} ${JSON.stringify(guildData)}`);
}

const globalEndpoint = `https://discord.com/api/v10/applications/${applicationId}/commands`;
const globalResponse = await fetch(globalEndpoint, {
  method: "POST",
  headers: {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(supportCommand),
});

const globalData = await globalResponse.json().catch(() => ({}));
if (!globalResponse.ok) {
  throw new Error(`Discord DM support command registration failed: ${globalResponse.status} ${JSON.stringify(globalData)}`);
}

console.log(`Registered Streamz Discord commands: guild /verify-pro, DM /support`);
