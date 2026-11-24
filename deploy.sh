#!/bin/bash

# Konfigurasi
SERVER="kudh@10.3.64.137"
PORT="${PORT:-22}"
PASSWORD = "ikanasin"
REMOTE_PATH="/www/wwwroot/flight-ticketing-system/"
LOCAL_DIST="dist/"
SSH_KEY="$HOME/.ssh/github_actions_flight_ticketing"

echo "🚀 Memulai deploy pake SSH Key..."

# Cek folder dist
if [ ! -d "$LOCAL_DIST" ]; then
    echo "❌ Folder $LOCAL_DIST katek! Build dulu."
    exit 1
fi

# Rsync pake spesifik SSH Key
rsync -avz --exclude="cookie/" \
 -e "ssh -p $PORT -i $SSH_KEY" "$LOCAL_DIST" "$SERVER:$REMOTE_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Deploy sukses, Lupin!"
else
    echo "❌ Gagal. Cek path SSH Key kau: $SSH_KEY"
fi