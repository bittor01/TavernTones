# Forking and Setting Up Your Own Three-Dragon Ante Bot

This guide will walk you through the process of creating your own private copy of this bot, setting up a Discord application, and running it using Docker.

## Part 1: Create a New Private Repository on GitHub

First, you'll need to create a new, empty private repository on GitHub.

1.  Go to the [new repository page on GitHub](https://github.com/new).
2.  Give your repository a name (e.g., `my-tda-bot`).
3.  Select the **Private** option. This is important to keep your bot's token and other information secure.
4.  **Do not** initialize the repository with a README, .gitignore, or license. It needs to be completely empty.
5.  Click **Create repository**.

## Part 2: Mirror the Repository

Now, we will copy the entire contents of this project, including its full commit history, to your new private repository.

1.  **Clone a bare copy of this repository:**
    Open your terminal or command prompt and run the following command. This creates a special kind of clone that contains the entire history but no working files.
    ```bash
    git clone --bare https://github.com/your-username/three-dragon-ante-bot.git
    ```
    *(Replace `https://github.com/your-username/three-dragon-ante-bot.git` with the actual URL of this repository)*

2.  **Navigate into the bare clone:**
    ```bash
    cd three-dragon-ante-bot.git
    ```

3.  **Push the mirrored content to your new private repository:**
    Use the URL of the private repository you created in Part 1.
    ```bash
    git push --mirror https://github.com/YOUR_USERNAME/YOUR_PRIVATE_REPO_NAME.git
    ```
    *(Replace `YOUR_USERNAME` and `YOUR_PRIVATE_REPO_NAME` with your actual GitHub username and the name of the private repository you just created.)*

4.  **Clean up:**
    You can now delete the local bare clone folder you created.
    ```bash
    cd ..
    rm -rf three-dragon-ante-bot.git
    ```

You now have a complete, private copy of this project in your own GitHub account!

## Part 3: Set Up Your Discord Bot Application

To run the bot, you need to create a bot application in the Discord Developer Portal.

1.  **Go to the [Discord Developer Portal](https://discord.com/developers/applications) and log in.**
2.  **Create a New Application:**
    *   Click the **New Application** button.
    *   Give it a name (e.g., "My TDA Bot") and click **Create**.
3.  **Get the Client ID:**
    *   On the "General Information" page, you'll see your **Application ID**. Copy this value; it is your `CLIENT_ID`.
4.  **Create a Bot User:**
    *   Go to the **Bot** tab on the left.
    *   Click **Add Bot**, then **Yes, do it!**.
5.  **Get the Bot Token:**
    *   Under the bot's username, you'll see a section for the **Token**. Click **Reset Token**, then **Yes, do it!**.
    *   Copy the token that appears. **Treat this like a password! Do not share it with anyone.** This is your `DISCORD_TOKEN`.
6.  **Get your Server (Guild) ID:**
    *   In your Discord client, you need to enable Developer Mode. Go to `User Settings > Advanced > Developer Mode` and turn it on.
    *   Right-click on your server's icon on the left-hand side and click **Copy Server ID**. This is your `GUILD_ID`.
7.  **Invite the Bot to Your Server:**
    *   Go back to the Developer Portal and navigate to the **OAuth2 > URL Generator** tab.
    *   In the "Scopes" section, check the box for `bot` and `applications.commands`.
    *   In the "Bot Permissions" section that appears below, check the box for **Administrator**. This is the simplest way to ensure the bot has all the permissions it needs to create threads, send messages, etc.
    *   Copy the generated URL at the bottom of the page, paste it into your browser, and follow the instructions to invite the bot to your server.

## Part 4: Run the Bot with Docker

Now you're ready to run the bot!

1.  **Clone your new private repository to your local machine:**
    ```bash
    git clone https://github.com/YOUR_USERNAME/YOUR_PRIVATE_REPO_NAME.git
    cd YOUR_PRIVATE_REPO_NAME
    ```

2.  **Create your `.env` file:**
    Copy the example file to a new file named `.env`.
    ```bash
    cp .env.example .env
    ```

3.  **Edit the `.env` file:**
    Open the `.env` file in a text editor and replace the placeholder values with the credentials you gathered in Part 3.
    ```
    DISCORD_TOKEN=PASTE_YOUR_BOT_TOKEN_HERE
    CLIENT_ID=PASTE_YOUR_CLIENT_ID_HERE
    GUILD_ID=PASTE_YOUR_GUILD_ID_HERE
    ```

4.  **Deploy the Slash Commands:**
    Before starting the bot, you need to register its slash commands with Discord. Run the following command:
    ```bash
    docker-compose run --rm bot npm run deploy
    ```
    This command will build the Docker image if it doesn't exist, run the `deploy-commands.js` script to register the `/play-tda` command on your server, and then stop.

5.  **Start the Bot:**
    Now you can start the bot itself.
    ```bash
    docker-compose up --build
    ```
    To run it in the background (detached mode), use:
    ```bash
    docker-compose up --build -d
    ```

Your Three-Dragon Ante bot should now be online and ready to accept the `/play-tda` command in your server! To stop the bot if it's running in the foreground, press `Ctrl+C`. If it's in detached mode, use `docker-compose down`.