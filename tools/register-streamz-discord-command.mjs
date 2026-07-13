const applicationId = process.env.DISCORD_APPLICATION_ID || "1526084195263447171";
const guildId = process.env.DISCORD_GUILD_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!guildId) {
  throw new Error("DISCORD_GUILD_ID is required.");
}

if (!botToken) {
  throw new Error("DISCORD_BOT_TOKEN is required.");
}

const command = {
  name: "verify-pro",
  description: "Privately verify a paid Streamz Pro purchase.",
  type: 1,
  options: [
    {
      name: "code",
      description: "Your Streamz Pro verification code, for example VP-7K4M-92QX.",
      type: 3,
      required: true,
    },
  ],
};

const endpoint = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(command),
});

const data = await response.json().catch(() => ({}));
if (!response.ok) {
  throw new Error(`Discord command registration failed: ${response.status} ${JSON.stringify(data)}`);
}

console.log(`Registered /verify-pro command: ${data.id || "ok"}`);
