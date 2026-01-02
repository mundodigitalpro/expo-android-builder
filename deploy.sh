#!/bin/bash
# Quick deploy script - delegates to server/deploy.sh
# Can be run from anywhere in the project

set -e

# Navigate to script directory
cd "$(dirname "$0")"

# Execute server deploy script
exec ./server/deploy.sh
