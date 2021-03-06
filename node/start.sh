#!/bin/sh

# Validation.
if [ ! $APPINSIGHTS_INSTRUMENTATIONKEY ];
then
    echo "Warning: Application Insights is not setup.  Application will log to console."
fi

# Run app.
APPINSIGHTS_INSTRUMENTATIONKEY=$(cat $APPINSIGHTS_INSTRUMENTATIONKEY) DISCORD_CLIENTID=$(cat $DISCORD_CLIENTID_FILE) DISCORD_CLIENTSECRET=$(cat $DISCORD_CLIENTSECRET_FILE) DISCORD_TOKEN=$(cat $DISCORD_TOKEN_FILE) ENCRYPTION_KEY=$(cat $ENCRYPTION_KEY_FILE) REDIS_PASSWORD=$(cat $REDIS_PASSWORD_FILE) TWITCH_BOT_ACCESSTOKEN=$(cat $TWITCH_BOT_ACCESSTOKEN_FILE) TWITCH_BOT_REFRESHTOKEN=$(cat $TWITCH_BOT_REFRESHTOKEN_FILE) TWITCH_CHANNEL_ACCESSTOKEN=$(cat $TWITCH_CHANNEL_ACCESSTOKEN_FILE) TWITCH_CHANNEL_REFRESHTOKEN=$(cat $TWITCH_CHANNEL_REFRESHTOKEN_FILE) TWITCH_CLIENTID=$(cat $TWITCH_CLIENTID_FILE) TWITCH_CLIENTSECRET=$(cat $TWITCH_CLIENTSECRET_FILE) WEB_SIXGG_PASSWORD=$(cat $WEB_SIXGG_PASSWORD_FILE) node index
