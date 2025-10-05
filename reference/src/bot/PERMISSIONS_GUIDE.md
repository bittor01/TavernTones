# Guide to Required Bot Permissions & Intents

This guide provides the necessary steps to configure your Discord bot's permissions and intents correctly. Following these instructions will help resolve common "Missing Access" errors, especially those related to creating threads and sending messages in private channels.

### Part 1: Discord Developer Portal Settings

Before the bot can use certain permissions, you need to enable the necessary **Privileged Gateway Intents** in its online dashboard.

1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Select your bot's application.
3.  Click on the "**Bot**" tab in the left-hand menu.
4.  Scroll down to the "**Privileged Gateway Intents**" section.
5.  Make sure the following intents are **enabled (toggled on)**:
    *   `SERVER MEMBERS INTENT`: This is required for the bot to receive events related to guild members. It corresponds to the `GatewayIntentBits.GuildMembers` intent in the code.
    *   `MESSAGE CONTENT INTENT`: **This should be DISABLED**. This bot uses Slash Commands and does not need to read message content.

### Part 2: Discord Server Permissions

Incorrect role permissions are a common cause of "Missing Access" errors.

1.  **Go to your Server Settings** > **Roles**.
2.  Find or create a role for your bot. **Crucially, ensure this role is positioned high up in the role list**, above the roles of regular users.
3.  Click "**Edit**" for the bot's role and go to the "**Permissions**" tab.
4.  Ensure the following permissions are **ENABLED**:

    *   **General Text Permissions:**
        *   `View Channels`
        *   `Send Messages`
        *   `Embed Links` (The bot uses embeds for its responses).

    *   **Thread Permissions (CRUCIAL for this bot):**
        *   `Send Messages in Threads`
        *   `Create Public Threads`
        *   `Create Private Threads`

### Part 3: Private Channel Permissions (The Most Common Issue)

If you are using the bot in a **private channel**, server-wide permissions are not enough. This is the most common reason for the `50001: Missing Access` error.

When a channel is private, it denies permissions for `@everyone`. You must explicitly override this for your bot's role.

1.  Go to the private channel where you want the bot to operate.
2.  **Right-click the channel** and select "**Edit Channel**" > "**Permissions**".
3.  Click the "**+**" button next to "Roles/Members" and add your bot's role.
4.  For the bot's role, you must set an **explicit ALLOW (the green checkmark)** for the following permissions. A neutral slash (`/`) is not sufficient as it will inherit the deny from `@everyone`.
    *   ✅ `View Channel`
    *   ✅ `Send Messages`
    *   ✅ `Send Messages in Threads`
    *   ✅ `Create Public Threads`

Setting these explicit `ALLOW`s in the channel's permissions will override the default private channel restrictions and is the most critical step to ensure the bot works correctly in a restricted environment.