#!/bin/bash
# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"
FILENAME="vatikart_$(date +%F_%H-%M-%S).dump"

# Strip ?schema=public or &schema=public since pg_dump does not support it
CLEAN_DB_URL=$(echo "$DATABASE_URL" | sed 's/[&?]schema=[^&]*//g')

echo "Starting database backup..."
pg_dump "$CLEAN_DB_URL" -F c -b -v -f "$BACKUP_DIR/$FILENAME"

echo "Backup complete: $BACKUP_DIR/$FILENAME"
