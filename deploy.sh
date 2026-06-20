#!/bin/bash
# Deploy script - Upload modified files to Hostgator via FTPS
# Uses lftp mirror to only upload changed files

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/ftp_config.json"

# Read FTP config
HOST=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['host'])")
PORT=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['port'])")
USER=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['username'])")
PASS=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['password'])")
SECURE=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['secure_ftps'])")
PASSIVE=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['passive_mode'])")
TIMEOUT=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['timeout_sec'])")

# Remote directory (root of the FTP)
REMOTE_DIR="/"

# Local directory to upload
LOCAL_DIR="$SCRIPT_DIR"

# Files/directories to exclude from upload
EXCLUDES="--exclude .DS_Store \
  --exclude .git/ \
  --exclude ftp_config.json \
  --exclude deploy.sh \
  --exclude design/ \
  --exclude _private/"

# Build lftp settings
LFTP_SETTINGS="set net:timeout $TIMEOUT;"
LFTP_SETTINGS+="set net:max-retries 3;"
LFTP_SETTINGS+="set net:reconnect-interval-base 5;"

if [ "$SECURE" = "True" ]; then
  LFTP_SETTINGS+="set ftp:ssl-force true;"
  LFTP_SETTINGS+="set ssl:verify-certificate no;"
fi

if [ "$PASSIVE" = "True" ]; then
  LFTP_SETTINGS+="set ftp:passive-mode true;"
fi

echo "========================================="
echo " Deploying to $HOST"
echo "========================================="
echo "Local:  $LOCAL_DIR"
echo "Remote: $REMOTE_DIR"
echo ""

# Run lftp mirror (reverse = upload, only-newer = skip unchanged)
lftp -c "
$LFTP_SETTINGS
open -u '$USER','$PASS' -p $PORT $HOST;
mirror --reverse --only-newer --verbose \
  $EXCLUDES \
  '$LOCAL_DIR' '$REMOTE_DIR';
bye
"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✓ Deploy completed successfully!"
else
  echo ""
  echo "✗ Deploy failed with exit code $EXIT_CODE"
fi

exit $EXIT_CODE
