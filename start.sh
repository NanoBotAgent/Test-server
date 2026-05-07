#!/bin/bash

VIAPROXY_JAR="ViaProxy.jar"
VIAPROXY_URL="https://github.com/ViaVersion/ViaProxy/releases/latest/download/ViaProxy.jar"

# Download ViaProxy if not already present
if [ ! -f "$VIAPROXY_JAR" ]; then
  echo "Downloading ViaProxy..."
  curl -L -o "$VIAPROXY_JAR" "$VIAPROXY_URL"
fi

# Start ViaProxy headlessly
# Listens on :25566, forwards to your 26.1.x server
echo "Starting ViaProxy..."
java -jar $VIAPROXY_JAR \
  --bind_address 127.0.0.1 \
  --bind_port 25566 \
  --target_address "$MC_HOST" \
  --target_port "${MC_PORT:-25565}" \
  --version "26.1.2" \
  --auth_method none &

# Wait for ViaProxy to be ready
sleep 5

# Start the bot
echo "Starting Mineflayer bot..."
node index.js
