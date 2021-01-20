/**
 * @typedef {import("twitch").AuthProvider} AuthProvider
 * @typedef {import("twitch-chat-client").ChatClient} ChatClient
 * @typedef {import("../../types/node/igdbTypes").SearchGameResult} IGDBTypes.SearchGameResult
 * @typedef {import("twitch-webhooks").Subscription} WebhooksSubscriptions
 */

const events = require("events"),
    IGDB = require("igdb-api-node"),
    TwitchAuth = require("twitch-auth"),
    TwitchClient = require("twitch").ApiClient,

    Chat = require("./chat"),
    Exception = require("../logging/exception"),
    Log = require("../logging/log"),
    PubSub = require("./pubsub"),
    Sleep = require("../sleep"),
    TwitchDb = require("../database/twitch"),
    Webhooks = require("./webhooks");

/** @type {AuthProvider} */
let apiAuthProvider;

/** @type {string} */
let botAccessToken;

/** @type {AuthProvider} */
let botAuthProvider;

/** @type {string} */
let botRefreshToken;

/** @type {Chat} */
let botChatClient;

/** @type {TwitchClient} */
let botTwitchClient;

/** @type {string} */
let channelAccessToken;

/** @type {AuthProvider} */
let channelAuthProvider;

/** @type {string} */
let channelRefreshToken;

/** @type {TwitchClient} */
let channelTwitchClient;

/** @type {Chat} */
let channelChatClient;

/** @type {PubSub} */
let pubsub;

/** @type {Webhooks} */
let webhooks;

/** @type {WebhooksSubscriptions[]} */
const webhookSubscriptions = [];

const eventEmitter = new events.EventEmitter();

//  #####           #     #            #
//    #                   #            #
//    #    #   #   ##    ####    ###   # ##
//    #    #   #    #     #     #   #  ##  #
//    #    # # #    #     #     #      #   #
//    #    # # #    #     #  #  #   #  #   #
//    #     # #    ###     ##    ###   #   #
/**
 * Handles Twitch integration.
 */
class Twitch {
    // #            #     ##   #            #     ##   ##     #                 #
    // #            #    #  #  #            #    #  #   #                       #
    // ###    ##   ###   #     ###    ###  ###   #      #    ##     ##   ###   ###
    // #  #  #  #   #    #     #  #  #  #   #    #      #     #    # ##  #  #   #
    // #  #  #  #   #    #  #  #  #  # ##   #    #  #   #     #    ##    #  #   #
    // ###    ##     ##   ##   #  #   # #    ##   ##   ###   ###    ##   #  #    ##
    /**
     * Gets the current Twitch bot chat client.
     * @returns {ChatClient} The current Twitch bot client.
     */
    static get botChatClient() {
        return botChatClient.client;
    }

    // #            #    ###          #     #          #      ##   ##     #                 #
    // #            #     #                 #          #     #  #   #                       #
    // ###    ##   ###    #    #  #  ##    ###    ##   ###   #      #    ##     ##   ###   ###
    // #  #  #  #   #     #    #  #   #     #    #     #  #  #      #     #    # ##  #  #   #
    // #  #  #  #   #     #    ####   #     #    #     #  #  #  #   #     #    ##    #  #   #
    // ###    ##     ##   #    ####  ###     ##   ##   #  #   ##   ###   ###    ##   #  #    ##
    /**
     * Gets the current Twitch bot client.
     * @returns {TwitchClient} The current Twitch client.
     */
    static get botTwitchClient() {
        return botTwitchClient;
    }

    //                                      #
    //                                      #
    //  ##    ##   ###   ###    ##    ##   ###
    // #     #  #  #  #  #  #  # ##  #      #
    // #     #  #  #  #  #  #  ##    #      #
    //  ##    ##   #  #  #  #   ##    ##     ##
    /**
     * Connects to Twitch.
     * @returns {Promise<boolean>} A promise that returns whether the Twitch client is ready.
     */
    static async connect() {
        const db = new TwitchDb();

        let tokens;
        try {
            tokens = await db.get();
        } catch (err) {
            throw new Exception("There was an error getting the Twitch tokens.", err);
        }

        if (!tokens || !tokens.channelAccessToken || !tokens.channelRefreshToken || !tokens.botAccessToken || !tokens.botRefreshToken) {
            tokens = {
                botAccessToken: process.env.TWITCH_BOT_ACCESSTOKEN,
                botRefreshToken: process.env.TWITCH_BOT_REFRESHTOKEN,
                channelAccessToken: process.env.TWITCH_CHANNEL_ACCESSTOKEN,
                channelRefreshToken: process.env.TWITCH_CHANNEL_REFRESHTOKEN
            };

            try {
                await db.set(tokens);
            } catch (err) {
                throw new Exception("There was an error setting the Twitch tokens on connecting.", err);
            }
        }

        channelAccessToken = tokens.channelAccessToken;
        channelRefreshToken = tokens.channelRefreshToken;
        botAccessToken = tokens.botAccessToken;
        botRefreshToken = tokens.botRefreshToken;

        if (!channelAccessToken || !channelRefreshToken || !botAccessToken || !botRefreshToken) {
            return false;
        }

        if (!channelAuthProvider || !botAuthProvider) {
            Log.log("Logging into Twitch...");
            try {
                await Twitch.login();
            } catch (err) {
                Log.exception("Error connecting to Twitch.  You can try again by refreshing the control page.", err);
            }

            Log.log("Connected to Twitch.");
        }

        return !!(channelAuthProvider && botAuthProvider);
    }

    //                          #
    //                          #
    //  ##   # #    ##   ###   ###    ###
    // # ##  # #   # ##  #  #   #    ##
    // ##    # #   ##    #  #   #      ##
    //  ##    #     ##   #  #    ##  ###
    /**
     * Returns the EventEmitter for Twitch events.
     * @returns {events.EventEmitter} The EventEmitter object.
     */
    static get events() {
        return eventEmitter;
    }

    // ##                 #
    //  #
    //  #     ##    ###  ##    ###
    //  #    #  #  #  #   #    #  #
    //  #    #  #   ##    #    #  #
    // ###    ##   #     ###   #  #
    //              ###
    /**
     * Logs in to Twitch and creates the Twitch client.
     * @returns {Promise} A promise that resolves when login is complete.
     */
    static async login() {
        channelAuthProvider = new TwitchAuth.RefreshableAuthProvider(
            new TwitchAuth.StaticAuthProvider(process.env.TWITCH_CLIENTID, channelAccessToken, process.env.TWITCH_CHANNEL_SCOPES.split(" "), "user"),
            {
                clientSecret: process.env.TWITCH_CLIENTSECRET,
                expiry: null,
                refreshToken: channelRefreshToken,
                onRefresh: async (token) => {
                    channelAccessToken = token.accessToken;
                    channelRefreshToken = token.refreshToken;
                    try {
                        const db = new TwitchDb();
                        await db.set({
                            botAccessToken,
                            botRefreshToken,
                            channelAccessToken,
                            channelRefreshToken
                        });
                    } catch (err) {
                        throw new Exception("There was an error setting the Twitch tokens on refreshing the channel tokens.", err);
                    }
                }
            }
        );

        channelTwitchClient = new TwitchClient({
            authProvider: channelAuthProvider,
            initialScopes: process.env.TWITCH_CHANNEL_SCOPES.split(" "),
            preAuth: true
        });

        botAuthProvider = new TwitchAuth.RefreshableAuthProvider(
            new TwitchAuth.StaticAuthProvider(process.env.TWITCH_CLIENTID, botAccessToken, process.env.TWITCH_BOT_SCOPES.split(" "), "user"),
            {
                clientSecret: process.env.TWITCH_CLIENTSECRET,
                expiry: null,
                refreshToken: botRefreshToken,
                onRefresh: async (token) => {
                    botAccessToken = token.accessToken;
                    botRefreshToken = token.refreshToken;
                    try {
                        const db = new TwitchDb();
                        await db.set({
                            botAccessToken,
                            botRefreshToken,
                            channelAccessToken,
                            channelRefreshToken
                        });
                    } catch (err) {
                        throw new Exception("There was an error setting the Twitch tokens on refreshing the bot tokens.", err);
                    }
                }
            }
        );

        botTwitchClient = new TwitchClient({
            authProvider: botAuthProvider,
            initialScopes: process.env.TWITCH_BOT_SCOPES.split(" "),
            preAuth: true
        });

        apiAuthProvider = new TwitchAuth.ClientCredentialsAuthProvider(process.env.TWITCH_CLIENTID, process.env.TWITCH_CLIENTSECRET);

        await Twitch.setupChat();
        await Twitch.setupPubSub();
        await Twitch.setupWebhooks();
    }

    //               #                      #     ###         #
    //              # #                     #      #          #
    // ###    ##    #    ###    ##    ###   ###    #     ##   # #    ##   ###    ###
    // #  #  # ##  ###   #  #  # ##  ##     #  #   #    #  #  ##    # ##  #  #  ##
    // #     ##     #    #     ##      ##   #  #   #    #  #  # #   ##    #  #    ##
    // #      ##    #    #      ##   ###    #  #   #     ##   #  #   ##   #  #  ###
    /**
     * Refreshes Twitch tokens.
     * @returns {Promise} A promsie that resolves when the tokens are refreshed.
     */
    static async refreshTokens() {
        try {
            await channelAuthProvider.refresh();
            await botAuthProvider.refresh();
        } catch (err) {
            eventEmitter.emit("error", {
                message: "Error refreshing twitch client tokens.",
                err
            });
        }

        await Twitch.setupChat();
        await Twitch.setupPubSub();
        await Twitch.setupWebhooks();
    }

    //                                #      ##                     #      #            #
    //                                #     #  #                    #                   #
    //  ###    ##    ###  ###    ##   ###   #      ###  # #    ##   #     ##     ###   ###
    // ##     # ##  #  #  #  #  #     #  #  # ##  #  #  ####  # ##  #      #    ##      #
    //   ##   ##    # ##  #     #     #  #  #  #  # ##  #  #  ##    #      #      ##    #
    // ###     ##    # #  #      ##   #  #   ###   # #  #  #   ##   ####  ###   ###      ##
    /**
     * Searches IGDB for a game.
     * @param {string} search The game to search for.
     * @returns {Promise<IGDBTypes.SearchGameResult[]>} A promise that returns the game from IGDB.
     */
    static async searchGameList(search) {
        const client = IGDB.default(apiAuthProvider.clientId, (await apiAuthProvider.getAccessToken()).accessToken),
            res = await client.where(`name ~ "${search.replace(/"/g, "\\\"")}"*`).fields(["id", "name", "cover.url"]).limit(50).request("/games");

        return res.data;
    }

    //               #     ##    #                            ###           #
    //               #    #  #   #                             #           # #
    //  ###    ##   ###    #    ###   ###    ##    ###  # #    #    ###    #     ##
    // ##     # ##   #      #    #    #  #  # ##  #  #  ####   #    #  #  ###   #  #
    //   ##   ##     #    #  #   #    #     ##    # ##  #  #   #    #  #   #    #  #
    // ###     ##     ##   ##     ##  #      ##    # #  #  #  ###   #  #   #     ##
    /**
     * Sets the stream's title and game.
     * @param {string} title The title of the stream.
     * @param {string} game The game.
     * @returns {Promise} A promise that resolves when the stream's info has been set.
     */
    static async setStreamInfo(title, game) {
        await channelTwitchClient.kraken.channels.updateChannel(process.env.TWITCH_USERID, {status: title, game});
    }

    //               #                 ##   #            #
    //               #                #  #  #            #
    //  ###    ##   ###   #  #  ###   #     ###    ###  ###
    // ##     # ##   #    #  #  #  #  #     #  #  #  #   #
    //   ##   ##     #    #  #  #  #  #  #  #  #  # ##   #
    // ###     ##     ##   ###  ###    ##   #  #   # #    ##
    //                          #
    /**
     * Sets up the Twitch chat.
     * @returns {Promise} A promise that resolves when the Twitch chat is setup.
     */
    static async setupChat() {
        if (channelChatClient && channelChatClient.client) {
            try {
                await channelChatClient.client.quit();
            } catch (err) {} finally {}
        }
        channelChatClient = new Chat(channelTwitchClient);

        if (botChatClient && botChatClient.client) {
            try {
                await botChatClient.client.quit();
            } catch (err) {} finally {}
        }

        botChatClient = new Chat(botTwitchClient);

        channelChatClient.client.onAction((channel, user, message, msg) => {
            eventEmitter.emit("action", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user,
                name: msg.userInfo.displayName,
                message
            });
        });

        channelChatClient.client.onCommunityPayForward((channel, user, forwardInfo) => {
            eventEmitter.emit("subGiftCommunityPayForward", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user,
                name: forwardInfo.displayName,
                originalGifter: forwardInfo.originalGifterDisplayName
            });
        });

        channelChatClient.client.onCommunitySub((channel, user, subInfo) => {
            eventEmitter.emit("subGiftCommunity", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user,
                name: subInfo.gifterDisplayName,
                giftCount: subInfo.count,
                totalGiftCount: subInfo.gifterGiftCount,
                tier: subInfo.plan
            });
        });

        channelChatClient.client.onDisconnect(async (manually, reason) => {
            if (reason) {
                Log.exception("The streamer's Twitch chat disconnected.", reason);
            }

            if (!manually) {
                await Twitch.setupChat();
            }
        });

        channelChatClient.client.onGiftPaidUpgrade((channel, user, subInfo) => {
            eventEmitter.emit("subGiftUpgrade", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user,
                name: subInfo.displayName,
                gifter: subInfo.gifterDisplayName,
                tier: subInfo.plan
            });
        });

        channelChatClient.client.onHost(async (channel, target, viewers) => {
            let user;
            try {
                user = (await channelTwitchClient.kraken.search.searchChannels(target)).find((c) => c.displayName === target);
            } catch (err) {} finally {}

            eventEmitter.emit("host", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user: user ? user.name : target,
                name: target,
                viewerCount: viewers
            });
        });

        channelChatClient.client.onHosted(async (channel, byChannel, auto, viewers) => {
            let user;
            try {
                user = (await channelTwitchClient.kraken.search.searchChannels(byChannel)).find((c) => c.displayName === byChannel);
            } catch (err) {} finally {}

            eventEmitter.emit("hosted", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user: user ? user.name : byChannel,
                name: byChannel.charAt(0) === "#" ? byChannel.substr(1) : byChannel,
                auto,
                viewerCount: viewers
            });
        });

        channelChatClient.client.onMessage((channel, user, message, msg) => {
            eventEmitter.emit("message", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user,
                name: msg.userInfo.displayName,
                message,
                msg
            });
        });

        channelChatClient.client.onPrimeCommunityGift((channel, user, subInfo) => {
            eventEmitter.emit("giftPrime", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user: subInfo.gifter,
                name: subInfo.gifterDisplayName,
                gift: subInfo.name
            });
        });

        channelChatClient.client.onPrimePaidUpgrade((channel, user, subInfo) => {
            eventEmitter.emit("subPrimeUpgraded", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user,
                name: subInfo.displayName,
                tier: subInfo.plan
            });
        });

        channelChatClient.client.onRaid((channel, user, raidInfo) => {
            eventEmitter.emit("raided", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user,
                name: raidInfo.displayName,
                viewerCount: raidInfo.viewerCount
            });
        });

        channelChatClient.client.onResub((channel, user, subInfo) => {
            eventEmitter.emit("resub", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user,
                name: subInfo.displayName,
                isPrime: subInfo.isPrime,
                message: subInfo.message,
                months: subInfo.months,
                streak: subInfo.streak,
                tier: subInfo.plan
            });
        });

        channelChatClient.client.onRitual((channel, user, ritualInfo, msg) => {
            eventEmitter.emit("ritual", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user,
                name: msg.userInfo.displayName,
                message: ritualInfo.message,
                ritual: ritualInfo.ritualName
            });
        });

        channelChatClient.client.onStandardPayForward((channel, user, forwardInfo) => {
            eventEmitter.emit("subGiftPayForward", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user,
                name: forwardInfo.displayName,
                originalGifter: forwardInfo.originalGifterDisplayName,
                recipient: forwardInfo.recipientDisplayName
            });
        });

        channelChatClient.client.onSub((channel, user, subInfo) => {
            eventEmitter.emit("sub", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user,
                name: subInfo.displayName,
                isPrime: subInfo.isPrime,
                message: subInfo.message,
                months: subInfo.months,
                streak: subInfo.streak,
                tier: subInfo.plan
            });
        });

        channelChatClient.client.onSubExtend((channel, user, subInfo) => {
            eventEmitter.emit("subExtend", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user,
                displayName: subInfo.displayName,
                months: subInfo.months,
                tier: subInfo.plan
            });
        });

        channelChatClient.client.onSubGift((channel, user, subInfo) => {
            eventEmitter.emit("subGift", {
                channel: channel.charAt(0) === "#" ? channel.substr(1) : channel,
                user,
                name: subInfo.displayName,
                gifterUser: subInfo.gifter,
                gifterName: subInfo.gifterDisplayName,
                totalGiftCount: subInfo.gifterGiftCount,
                isPrime: subInfo.isPrime,
                message: subInfo.message,
                months: subInfo.months,
                streak: subInfo.streak,
                tier: subInfo.plan
            });
        });

        channelChatClient.client.onWhisper((user, message, msg) => {
            eventEmitter.emit("whisper", {
                user,
                name: msg.userInfo.displayName,
                message
            });
        });

        botChatClient.client.onDisconnect(async (manually, reason) => {
            if (reason) {
                Log.exception("The bot's Twitch chat disconnected.", reason);
            }

            if (!manually) {
                await Twitch.setupChat();
            }
        });

        channelChatClient.client.connect();
        botChatClient.client.connect();
    }

    //               #                ###         #      ##         #
    //               #                #  #        #     #  #        #
    //  ###    ##   ###   #  #  ###   #  #  #  #  ###    #    #  #  ###
    // ##     # ##   #    #  #  #  #  ###   #  #  #  #    #   #  #  #  #
    //   ##   ##     #    #  #  #  #  #     #  #  #  #  #  #  #  #  #  #
    // ###     ##     ##   ###  ###   #      ###  ###    ##    ###  ###
    //                          #
    /**
     * Sets up the Twitch PubSub subscriptions.
     * @returns {Promise} A promise that resolves when the Twitch PubSub subscriptions are setup.
     */
    static async setupPubSub() {
        pubsub = new PubSub();

        await pubsub.setup(channelTwitchClient);

        pubsub.client.onBits(process.env.TWITCH_USERID, async (message) => {
            eventEmitter.emit("bits", {
                userId: message.userId,
                user: message.userName,
                name: (await message.getUser()).displayName,
                bits: message.bits,
                totalBits: message.totalBits,
                message: message.message,
                isAnonymous: message.isAnonymous
            });
        });

        pubsub.client.onRedemption(process.env.TWITCH_USERID, (message) => {
            eventEmitter.emit("redemption", {
                userId: message.userId,
                user: message.userName,
                name: message.userDisplayName,
                message: message.message,
                date: message.redemptionDate,
                cost: message.rewardCost,
                reward: message.rewardName,
                isQueued: message.rewardIsQueued
            });
        });
    }

    //               #                #  #        #     #                 #
    //               #                #  #        #     #                 #
    //  ###    ##   ###   #  #  ###   #  #   ##   ###   ###    ##    ##   # #    ###
    // ##     # ##   #    #  #  #  #  ####  # ##  #  #  #  #  #  #  #  #  ##    ##
    //   ##   ##     #    #  #  #  #  ####  ##    #  #  #  #  #  #  #  #  # #     ##
    // ###     ##     ##   ###  ###   #  #   ##   ###   #  #   ##    ##   #  #  ###
    //                          #
    /**
     * Sets up the Twitch Webhooks subscriptions.
     * @returns {Promise} A promise that resolves when the Twitch Webhooks subscriptions are setup.
     */
    static async setupWebhooks() {
        if (webhooks && webhooks.listener) {
            for (const sub of webhookSubscriptions) {
                await sub.stop();
            }
        }

        new Sleep().sleep(1000);

        webhooks = new Webhooks();

        await webhooks.setup(channelTwitchClient);

        webhookSubscriptions.push(await webhooks.listener.subscribeToFollowsToUser(process.env.TWITCH_USERID, async (follow) => {
            eventEmitter.emit("follow", {
                userId: follow.userId,
                user: (await follow.getUser()).name,
                name: follow.userDisplayName,
                date: follow.followDate
            });
        }));

        webhookSubscriptions.push(await webhooks.listener.subscribeToStreamChanges(process.env.TWITCH_USERID, async (stream) => {
            if (stream) {
                const game = await stream.getGame();

                eventEmitter.emit("stream", {
                    title: stream.title,
                    game: game ? game.name : "",
                    id: stream.id,
                    startDate: stream.startDate,
                    thumbnailUrl: stream.thumbnailUrl
                });
            } else {
                eventEmitter.emit("offline");
            }
        }));
    }
}

module.exports = Twitch;
