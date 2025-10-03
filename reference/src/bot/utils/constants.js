/**
 * @file Defines constants used specifically by the Discord bot.
 * @author jules
 */

module.exports = {
    /**
     * The maximum number of requests the bot will send to the Discord API per second.
     * This is used by the rate limiter to prevent exceeding Discord's global rate limit.
     * The default is set to 40, which is safely below Discord's global limit of 50.
     * @type {number}
     */
    DISCORD_API_MAX_REQUESTS_PER_SECOND: 40,
};