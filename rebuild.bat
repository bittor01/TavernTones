@echo off
REM Stop and remove all services defined in the docker-compose.yml file.
echo Bringing down docker-compose services...
docker compose down

REM Remove the specific image for the bot service.
REM The image name 'three-dragon-ante-bot-bot' is derived from the project name ('three-dragon-ante-bot') and service name ('bot').
echo Removing old bot image...
docker rmi three-dragon-ante-bot-bot

REM Rebuild and start the bot service in detached mode.
REM --build forces the image to be rebuilt.
echo Rebuilding and starting the bot service...
docker compose up -d --build bot

echo Bot rebuild process complete.
timeout 10