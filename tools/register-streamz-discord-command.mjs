const applicationId = process.env.DISCORD_APPLICATION_ID || "1526084195263447171";
const guildId = process.env.DISCORD_GUILD_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!guildId) {
  throw new Error("DISCORD_GUILD_ID is required.");
}

if (!botToken) {
  throw new Error("DISCORD_BOT_TOKEN is required.");
}

const commands = [
  {
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
  },
  {
    name: "support",
    description: "Open a private Streamz Pro support request using your original activation-pass PDF.",
    type: 1,
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
  },
];

const endpoint = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;
const response = await fetch(endpoint, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});

const data = await response.json().catch(() => ({}));
if (!response.ok) {
  throw new Error(`Discord command registration failed: ${response.status} ${JSON.stringify(data)}`);
}

console.log(`Registered Streamz Discord commands: ${(Array.isArray(data) ? data.map((command) => `/${command.name}`).join(", ") : "ok")}`);
