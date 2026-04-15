#!/usr/bin/env bash
# Generate self-signed SSL certificate for RegInspector
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SSL_DIR="$PROJECT_DIR/nginx/ssl"

mkdir -p "$SSL_DIR"

if [ -f "$SSL_DIR/cert.pem" ] && [ -f "$SSL_DIR/key.pem" ]; then
    echo "SSL certificates already exist at $SSL_DIR"
    echo "  - cert.pem ($(stat -c%s "$SSL_DIR/cert.pem" 2>/dev/null || stat -f%z "$SSL_DIR/cert.pem") bytes)"
    echo "  - key.pem"
    read -p "Regenerate? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing certificates."
        exit 0
    fi
fi

echo "Generating self-signed SSL certificate..."

openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "$SSL_DIR/key.pem" \
    -out "$SSL_DIR/cert.pem" \
    -subj "/C=SA/ST=Riyadh/L=Riyadh/O=KPMG/OU=RegInspector/CN=reginspector.local"

echo ""
echo "SSL certificates generated:"
echo "  Certificate: $SSL_DIR/cert.pem"
echo "  Private key: $SSL_DIR/key.pem"
echo "  Valid for:   365 days"
echo ""
echo "Note: Browsers will show a security warning for self-signed certificates."
echo "Click 'Advanced' → 'Proceed' to continue."
