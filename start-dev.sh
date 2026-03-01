#!/bin/bash
# Vortex Prime - Development Launcher

echo "🎮 Vortex Prime - Starting Development Environment"
echo "=================================================="
echo ""

# Check if Rust is installed
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust not found! Please install from https://rustup.rs/"
    exit 1
fi
echo "✅ Rust found: $(rustc --version)"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found! Please install from https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js found: $(node --version)"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

# Check if Xenia exists
if [ ! -f "src-tauri/resources/xenia/xenia-canary.exe" ]; then
    echo "⚠️  Xenia not found at src-tauri/resources/xenia/xenia-canary.exe"
    echo "   Download from: https://github.com/xenia-canary/xenia-canary/releases"
fi

echo ""
echo "🚀 Launching Vortex Prime..."
echo ""

# Launch Tauri dev
npm run dev
