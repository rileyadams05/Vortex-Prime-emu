import { enqueueOfficialAlert } from "../alerts/queue";
import { store } from "../state/store";
import type { AccountConnection, AlertType, ProviderOAuthToken } from "../types";

type Provider = Extract<AccountConnection["id"], "kick" | "twitch" | "youtube">;

const STREAMZ_API_BASE = "https://vortex-prime-emu.com";
const controllers = new Map<Provider, ProviderRuntime>();

interface ProviderRuntime {
  stop(): void;
}

function providerLabel(provider: Provider) {
  return provider === "youtube" ? "YouTube" : provider.charAt(0).toUpperCase() + provider.slice(1);
}

function connectedAccount(provider: Provider) {
  return store.getState().accounts.find((account) => account.id === provider && account.state === "connected" && account.token);
}

function updateProviderError(provider: Provider, error?: string) {
  store.setState((state) => ({
    ...state,
    accounts: state.accounts.map((account) => (
      account.id === provider ? { ...account, lastError: error, detail: error ? `${providerLabel(provider)} connection needs attention` : account.detail } : account
    )),
  }));
}

async function refreshToken(provider: Provider, token: ProviderOAuthToken): Promise<ProviderOAuthToken> {
  if (!token.refreshToken) return token;
  const response = await fetch(`${STREAMZ_API_BASE}/api/streamz/auth/${provider}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: token.refreshToken }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.accessToken) {
    throw new Error(data?.message || `${providerLabel(provider)} token refresh failed`);
  }
  const refreshed: ProviderOAuthToken = {
    ...token,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || token.refreshToken,
    tokenType: data.tokenType || token.tokenType,
    scope: data.scope || token.scope,
    clientId: data.clientId || token.clientId,
    expiresAt: data.expiresIn ? new Date(Date.now() + Number(data.expiresIn) * 1000).toISOString() : token.expiresAt,
  };
  store.setState((state) => ({
    ...state,
    accounts: state.accounts.map((account) => account.id === provider ? { ...account, token: refreshed } : account),
  }));
  return refreshed;
}

async function validToken(provider: Provider, token: ProviderOAuthToken) {
  const expiresAt = token.expiresAt ? Date.parse(token.expiresAt) : 0;
  if (expiresAt && expiresAt - Date.now() < 90_000) {
    return refreshToken(provider, token);
  }
  return token;
}

function emitAlert(type: AlertType, eventId: string, user: string, extras: Record<string, unknown> = {}) {
  enqueueOfficialAlert({ type, eventId, user, platform: type.split("-")[0], ...extras } as any);
}

class TwitchRuntime implements ProviderRuntime {
  private socket?: WebSocket;
  private stopped = false;
  private reconnectTimer?: number;
  private keepaliveTimer?: number;

  constructor(private account: AccountConnection) {
    void this.connect();
  }

  stop() {
    this.stopped = true;
    window.clearTimeout(this.reconnectTimer);
    window.clearTimeout(this.keepaliveTimer);
    this.socket?.close();
  }

  private async connect() {
    if (this.stopped) return;
    try {
      const token = await validToken("twitch", this.account.token!);
      const user = await this.fetchUser(token);
      this.account = { ...this.account, token, providerUserId: user.id, providerChannelId: user.id };
      this.socket = new WebSocket("wss://eventsub.wss.twitch.tv/ws");
      this.socket.addEventListener("message", (event) => void this.handleMessage(event, token, user.id));
      this.socket.addEventListener("close", () => this.scheduleReconnect("Twitch EventSub connection closed"));
      this.socket.addEventListener("error", () => this.scheduleReconnect("Twitch EventSub connection error"));
      updateProviderError("twitch", undefined);
    } catch (error) {
      this.scheduleReconnect(error instanceof Error ? error.message : String(error));
    }
  }

  private async fetchUser(token: ProviderOAuthToken) {
    const response = await fetch("https://api.twitch.tv/helix/users", {
      headers: { Authorization: `Bearer ${token.accessToken}`, "Client-Id": token.clientId || "" },
    });
    const data = await response.json().catch(() => null);
    const user = data?.data?.[0];
    if (!response.ok || !user?.id) throw new Error(data?.message || "Twitch user lookup failed");
    return { id: String(user.id), name: String(user.display_name || user.login || "Twitch") };
  }

  private async handleMessage(event: MessageEvent, token: ProviderOAuthToken, broadcasterId: string) {
    const message = JSON.parse(String(event.data || "{}"));
    const metadata = message.metadata || {};
    const payload = message.payload || {};

    if (metadata.message_type === "session_welcome") {
      const sessionId = payload.session?.id;
      if (sessionId) await this.subscribe(sessionId, token, broadcasterId);
      return;
    }

    if (metadata.message_type === "session_keepalive") {
      window.clearTimeout(this.keepaliveTimer);
      this.keepaliveTimer = window.setTimeout(() => this.scheduleReconnect("Twitch keepalive timed out"), 25_000);
      return;
    }

    if (metadata.message_type === "session_reconnect" && payload.session?.reconnect_url) {
      this.socket?.close();
      this.socket = new WebSocket(payload.session.reconnect_url);
      this.socket.addEventListener("message", (next) => void this.handleMessage(next, token, broadcasterId));
      return;
    }

    if (metadata.message_type !== "notification") return;
    this.routeNotification(payload.subscription?.type, metadata.message_id, payload.event || {});
  }

  private async subscribe(sessionId: string, token: ProviderOAuthToken, broadcasterId: string) {
    const subscriptions = [
      { type: "channel.follow", version: "2", condition: { broadcaster_user_id: broadcasterId, moderator_user_id: broadcasterId } },
      { type: "channel.subscribe", version: "1", condition: { broadcaster_user_id: broadcasterId } },
      { type: "channel.subscription.gift", version: "1", condition: { broadcaster_user_id: broadcasterId } },
      { type: "channel.subscription.message", version: "1", condition: { broadcaster_user_id: broadcasterId } },
      { type: "channel.cheer", version: "1", condition: { broadcaster_user_id: broadcasterId } },
      { type: "channel.raid", version: "1", condition: { to_broadcaster_user_id: broadcasterId } },
      { type: "channel.channel_points_custom_reward_redemption.add", version: "1", condition: { broadcaster_user_id: broadcasterId } },
      { type: "stream.online", version: "1", condition: { broadcaster_user_id: broadcasterId } },
      { type: "stream.offline", version: "1", condition: { broadcaster_user_id: broadcasterId } },
    ];

    await Promise.allSettled(subscriptions.map((subscription) => fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Client-Id": token.clientId || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...subscription,
        transport: { method: "websocket", session_id: sessionId },
      }),
    })));
  }

  private routeNotification(type: string, eventId: string, event: any) {
    const user = event.user_name || event.from_broadcaster_user_name || event.broadcaster_user_name || "Twitch";
    if (type === "channel.follow") emitAlert("twitch-follow", eventId, user);
    if (type === "channel.subscribe") emitAlert("twitch-subscription", eventId, user, { level: event.tier });
    if (type === "channel.subscription.message") emitAlert("twitch-resubscription", eventId, user, { amount: Number(event.cumulative_months || 0) || undefined });
    if (type === "channel.subscription.gift") emitAlert("twitch-gifted-subscription", eventId, user, { quantity: Number(event.total || 1) });
    if (type === "channel.cheer") emitAlert("twitch-cheer", eventId, user, { amount: Number(event.bits || 0) || undefined });
    if (type === "channel.raid") emitAlert("twitch-raid", eventId, event.from_broadcaster_user_name || user, { amount: Number(event.viewers || 0) || undefined });
    if (type === "channel.channel_points_custom_reward_redemption.add") emitAlert("twitch-channel-point-redemption", eventId, user, { rewardTitle: event.reward?.title });
    if (type === "stream.online") emitAlert("twitch-stream-online", eventId, user);
    if (type === "stream.offline") emitAlert("twitch-stream-offline", eventId, user);
  }

  private scheduleReconnect(message: string) {
    if (this.stopped) return;
    updateProviderError("twitch", message);
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => void this.connect(), 10_000);
  }
}

class YouTubeRuntime implements ProviderRuntime {
  private stopped = false;
  private timer?: number;
  private liveChatId?: string;
  private nextPageToken?: string;
  private wasLive = false;

  constructor(private account: AccountConnection) {
    void this.poll();
  }

  stop() {
    this.stopped = true;
    window.clearTimeout(this.timer);
  }

  private async poll() {
    if (this.stopped) return;
    try {
      this.account = connectedAccount("youtube") || this.account;
      const token = await validToken("youtube", this.account.token!);
      this.account = { ...this.account, token };
      if (!this.liveChatId) await this.findActiveBroadcast(token);
      if (this.liveChatId) await this.pollChat(token);
      updateProviderError("youtube", undefined);
    } catch (error) {
      updateProviderError("youtube", error instanceof Error ? error.message : String(error));
      this.schedule(30_000);
    }
  }

  private async findActiveBroadcast(token: ProviderOAuthToken) {
    const response = await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status&broadcastStatus=active&mine=true", {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error?.message || "YouTube livestream lookup failed");
    const active = data?.items?.[0];
    if (active?.snippet?.liveChatId) {
      this.liveChatId = active.snippet.liveChatId;
      if (!this.wasLive) emitAlert("youtube-stream-online", `youtube-live:${active.id || this.liveChatId}`, active.snippet.channelTitle || "YouTube");
      this.wasLive = true;
      return;
    }
    if (this.wasLive) emitAlert("youtube-stream-offline", `youtube-offline:${Date.now()}`, "YouTube");
    this.wasLive = false;
    this.schedule(45_000);
  }

  private async pollChat(token: ProviderOAuthToken) {
    const url = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
    url.searchParams.set("part", "snippet,authorDetails");
    url.searchParams.set("liveChatId", this.liveChatId!);
    if (this.nextPageToken) url.searchParams.set("pageToken", this.nextPageToken);

    const response = await fetch(url, { headers: { Authorization: `Bearer ${token.accessToken}` } });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 404 || response.status === 403) {
        this.liveChatId = undefined;
        this.nextPageToken = undefined;
      }
      throw new Error(data?.error?.message || "YouTube live chat polling failed");
    }
    this.nextPageToken = data.nextPageToken || this.nextPageToken;
    for (const item of data.items || []) this.routeChatMessage(item);
    this.schedule(Math.max(5_000, Number(data.pollingIntervalMillis || 10_000)));
  }

  private routeChatMessage(item: any) {
    const id = String(item.id || `youtube:${Date.now()}`);
    const snippet = item.snippet || {};
    const author = item.authorDetails?.displayName || "YouTube viewer";

    if (snippet.superChatDetails) emitAlert("youtube-super-chat", id, author);
    if (snippet.superStickerDetails) emitAlert("youtube-super-sticker", id, author);
    if (snippet.newSponsorDetails || snippet.memberMilestoneChatDetails) emitAlert("youtube-new-member", id, author, { level: snippet.newSponsorDetails?.memberLevelName });
    if (snippet.membershipGiftingDetails || snippet.giftMembershipReceivedDetails) emitAlert("youtube-gifted-membership", id, author, { quantity: Number(snippet.membershipGiftingDetails?.giftMembershipsCount || 1) });
  }

  private schedule(ms: number) {
    if (this.stopped) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.poll(), ms);
  }
}

class KickRuntime implements ProviderRuntime {
  private stopped = false;
  private socket?: WebSocket;
  private reconnectTimer?: number;

  constructor(private account: AccountConnection) {
    void this.connect();
  }

  stop() {
    this.stopped = true;
    window.clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  private async connect() {
    if (this.stopped) return;
    try {
      this.account = connectedAccount("kick") || this.account;
      const chatroomId = this.account.providerUserId; // In Vortex, Kick profile.id is the channel.id (chatroom_id)
      if (!chatroomId) throw new Error("Kick chatroom ID missing");

      this.socket = new WebSocket("wss://ws-us2.pusher.com/app/eb1d5f283081a78b932c?protocol=7&client=js&version=7.6.0&flash=false");
      this.socket.addEventListener("open", () => {
        this.socket?.send(JSON.stringify({
          event: "pusher:subscribe",
          data: { auth: "", channel: `chatrooms.${chatroomId}.v2` }
        }));
        updateProviderError("kick", undefined);
      });
      this.socket.addEventListener("message", (event) => this.handleMessage(event));
      this.socket.addEventListener("close", () => this.scheduleReconnect("Kick connection closed"));
      this.socket.addEventListener("error", () => this.scheduleReconnect("Kick connection error"));
    } catch (error) {
      this.scheduleReconnect(error instanceof Error ? error.message : String(error));
    }
  }

  private handleMessage(event: MessageEvent) {
    const msg = JSON.parse(String(event.data || "{}"));
    if (msg.event === "pusher:connection_established") return;
    if (msg.event === "App\\Events\\StreamerIsLive") emitAlert("kick-stream-online", `kick-live:${Date.now()}`, "Kick");
  }

  private scheduleReconnect(message: string) {
    if (this.stopped) return;
    updateProviderError("kick", message);
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => void this.connect(), 10_000);
  }
}

export function startProviderRuntime(provider: Provider) {
  stopProviderRuntime(provider);
  const account = connectedAccount(provider);
  if (!account) return;
  if (provider === "twitch") controllers.set(provider, new TwitchRuntime(account));
  if (provider === "youtube") controllers.set(provider, new YouTubeRuntime(account));
  if (provider === "kick") controllers.set(provider, new KickRuntime(account));
}

export function stopProviderRuntime(provider: Provider) {
  controllers.get(provider)?.stop();
  controllers.delete(provider);
}

export function startConnectedProviderRuntimes() {
  (["twitch", "youtube", "kick"] as Provider[]).forEach(startProviderRuntime);
}
