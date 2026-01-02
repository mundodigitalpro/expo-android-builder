#!/bin/bash
# Deploy script for Expo Android Builder on VPS
# This script pulls latest changes and rebuilds the Docker container

set -e  # Exit on error

echo "🚀 Starting deployment of Expo Android Builder..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Pull latest changes from git
echo "📥 Pulling latest changes from repository..."
git pull origin main

# Navigate to server directory
cd server

# Stop running containers
echo "🛑 Stopping running containers..."
docker compose down

# Build with no cache to ensure fresh build
echo "🔨 Building Docker image (no cache)..."
docker compose build --no-cache

# Start containers in detached mode
echo "▶️  Starting containers..."
docker compose up -d

# Show logs
echo "📋 Recent logs:"
docker compose logs --tail=20

echo ""
echo "✅ Deployment completed successfully!"
echo "📊 Check container status: docker compose ps"
echo "📝 View logs: docker compose logs -f"
