#!/bin/bash

# Start Instagram OAuth Test with ngrok
# This creates a public URL for testing Instagram OAuth

echo "🚀 Starting Instagram OAuth Test Server..."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed!"
    echo ""
    echo "Install it with:"
    echo "  brew install ngrok"
    echo "  or download from https://ngrok.com/download"
    exit 1
fi

# Start Python HTTP server in background
echo "Starting HTTP server on port 8000..."
cd "$(dirname "$0")"
python3 -m http.server 8000 &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Start ngrok tunnel
echo "Starting ngrok tunnel..."
echo ""
ngrok http 8000 --log=stdout > /tmp/ngrok.log &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | grep -o 'https://[^"]*' | head -1)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Failed to get ngrok URL"
    kill $SERVER_PID $NGROK_PID
    exit 1
fi

echo "✅ Server is running!"
echo ""
echo "📱 Your public URL: $NGROK_URL"
echo ""
echo "🔧 Add this to your Facebook App settings:"
echo "   App Domains: ${NGROK_URL#https://}"
echo "   Instagram Basic Display → Valid OAuth Redirect URIs:"
echo "   $NGROK_URL/test-instagram-oauth.html"
echo ""
echo "🌐 Open this URL in your browser:"
echo "   $NGROK_URL/test-instagram-oauth.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Wait for Ctrl+C
trap "echo ''; echo 'Stopping servers...'; kill $SERVER_PID $NGROK_PID 2>/dev/null; exit" INT
wait
