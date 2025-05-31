#!/bin/bash

# Hestior Automation Dashboard Startup Script

echo "🚀 Starting Hestior Automation Dashboard..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Please copy env.example to .env and configure your settings:"
    echo "   cp env.example .env"
    echo "   nano .env"
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the application
echo "🌟 Launching dashboard on http://localhost:3000"
echo "📊 Press Ctrl+C to stop the server"
echo ""

npm run dev 