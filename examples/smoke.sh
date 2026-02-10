#!/usr/bin/env bash
#
# ARR REST API smoke test (curl + jq)
#
# Prerequisites:
#   - arr-mcp server running: node packages/arr-mcp/dist/index.js --transport http
#   - jq installed: https://jqlang.github.io/jq/
#   - Ed25519 keypair (generated below via openssl)
#
# Usage:
#   chmod +x examples/smoke.sh
#   ./examples/smoke.sh

set -euo pipefail

BASE="http://127.0.0.1:8787"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# ── Generate Ed25519 keypair ─────────────────────────────────────
openssl genpkey -algorithm ed25519 -out "$TMPDIR/private.pem" 2>/dev/null
openssl pkey -in "$TMPDIR/private.pem" -pubout -out "$TMPDIR/public.pem" 2>/dev/null

PRIVATE_KEY=$(cat "$TMPDIR/private.pem")
PUBLIC_KEY=$(cat "$TMPDIR/public.pem")

# Creator ID from public key (the server derives this; we pass it as-is for drafts)
CREATOR="smoke-test-$(date +%s)"

echo "=== ARR REST smoke test ==="
echo ""

# ── 1. Subscribe to SSE events (background) ─────────────────────
echo "[sse] Listening on $BASE/events ..."
curl -sN "$BASE/events" > "$TMPDIR/events.log" 2>/dev/null &
SSE_PID=$!

sleep 0.5

# ── 2. Create draft ─────────────────────────────────────────────
echo "[draft] POST /api/v1/attestation/draft"
DRAFT_RESPONSE=$(curl -s -X POST "$BASE/api/v1/attestation/draft" \
  -H "Content-Type: application/json" \
  -d "{
    \"creator\": \"$CREATOR\",
    \"intent\": \"Climate poster v1\",
    \"tool\": \"midjourney/6.1\",
    \"license\": \"CC-BY-4.0\"
  }")

ATTESTATION=$(echo "$DRAFT_RESPONSE" | jq -c '.attestation')
ATT_ID=$(echo "$ATTESTATION" | jq -r '.id')
echo "  attestation.id = $ATT_ID"

# ── 3. Sign ──────────────────────────────────────────────────────
echo "[sign] POST /api/v1/attestation/sign"
SIGN_RESPONSE=$(curl -s -X POST "$BASE/api/v1/attestation/sign" \
  -H "Content-Type: application/json" \
  -d "{
    \"attestation\": $ATTESTATION,
    \"private_key_pem\": $(echo "$PRIVATE_KEY" | jq -Rs .)
  }")

SIGNED=$(echo "$SIGN_RESPONSE" | jq -c '.signed_attestation')
SIG=$(echo "$SIGNED" | jq -r '.signature')
echo "  signature = ${SIG:0:30}..."

# ── 4. Verify ────────────────────────────────────────────────────
echo "[verify] POST /api/v1/attestation/verify"
VERIFY_RESPONSE=$(curl -s -X POST "$BASE/api/v1/attestation/verify" \
  -H "Content-Type: application/json" \
  -d "{
    \"signed_attestation\": $SIGNED,
    \"public_key_pem\": $(echo "$PUBLIC_KEY" | jq -Rs .)
  }")

VALID=$(echo "$VERIFY_RESPONSE" | jq -r '.result.valid')
echo "  valid = $VALID"

# ── 5. Renew ─────────────────────────────────────────────────────
echo "[renew] POST /api/v1/attestation/renew"
RENEW_RESPONSE=$(curl -s -X POST "$BASE/api/v1/attestation/renew" \
  -H "Content-Type: application/json" \
  -d "{
    \"renews\": \"$ATT_ID\",
    \"creator\": \"$CREATOR\",
    \"intent\": \"Climate poster v2\",
    \"private_key_pem\": $(echo "$PRIVATE_KEY" | jq -Rs .)
  }")

RENEWED_ID=$(echo "$RENEW_RESPONSE" | jq -r '.signed_attestation.attestation.id')
RENEWS_FIELD=$(echo "$RENEW_RESPONSE" | jq -r '.signed_attestation.attestation.renews')
echo "  new id = $RENEWED_ID"
echo "  renews = $RENEWS_FIELD"

# ── 6. Verify renewal ───────────────────────────────────────────
echo "[verify] POST /api/v1/attestation/verify (renewal)"
RENEWED_SIGNED=$(echo "$RENEW_RESPONSE" | jq -c '.signed_attestation')
VERIFY2_RESPONSE=$(curl -s -X POST "$BASE/api/v1/attestation/verify" \
  -H "Content-Type: application/json" \
  -d "{
    \"signed_attestation\": $RENEWED_SIGNED,
    \"public_key_pem\": $(echo "$PUBLIC_KEY" | jq -Rs .)
  }")

VALID2=$(echo "$VERIFY2_RESPONSE" | jq -r '.result.valid')
echo "  valid = $VALID2"

# ── 7. Revoke original ──────────────────────────────────────────
echo "[revoke] POST /api/v1/attestation/revoke"
REVOKE_RESPONSE=$(curl -s -X POST "$BASE/api/v1/attestation/revoke" \
  -H "Content-Type: application/json" \
  -d "{
    \"attestation_id\": \"$ATT_ID\",
    \"reason\": \"Superseded by v2\",
    \"private_key_pem\": $(echo "$PRIVATE_KEY" | jq -Rs .)
  }")

REVOKED_ID=$(echo "$REVOKE_RESPONSE" | jq -r '.revocation.revocation.attestation_id')
echo "  revoked = $REVOKED_ID"

# ── 8. Show captured SSE events ─────────────────────────────────
sleep 0.5
kill "$SSE_PID" 2>/dev/null || true
wait "$SSE_PID" 2>/dev/null || true

echo ""
echo "=== SSE events captured ==="
if [ -s "$TMPDIR/events.log" ]; then
  cat "$TMPDIR/events.log"
else
  echo "  (no events — server may not emit SSE for REST calls)"
fi

echo ""
echo "=== Done ==="
