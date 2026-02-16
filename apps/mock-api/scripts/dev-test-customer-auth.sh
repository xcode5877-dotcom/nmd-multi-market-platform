#!/bin/sh
# Quick dev test for customer OTP auth. Run mock-api first: pnpm dev
BASE=${1:-http://localhost:5190}

echo "1. POST /customer/auth/start { phone }"
curl -s -X POST "$BASE/customer/auth/start" -H "Content-Type: application/json" -d '{"phone":"0501234567"}' | jq .
echo ""
echo "2. Check server logs for OTP, then: POST /customer/auth/verify { phone, code }"
echo "   curl -s -X POST $BASE/customer/auth/verify -H 'Content-Type: application/json' -d '{\"phone\":\"0501234567\",\"code\":\"<OTP>\"}' | jq ."
echo ""
echo "3. GET /customer/me (use token from step 2)"
echo "   curl -s $BASE/customer/me -H 'Authorization: Bearer <TOKEN>' | jq ."
echo ""
echo "4. POST /orders with customer token (optional customerId)"
echo "   curl -s -X POST $BASE/orders -H 'Authorization: Bearer <TOKEN>' -H 'Content-Type: application/json' -d '{\"tenantId\":\"5b35539f-90e1-49cc-8c32-8d26cdce20f2\",\"fulfillmentType\":\"PICKUP\",\"items\":[],\"subtotal\":0,\"total\":0}' | jq ."
