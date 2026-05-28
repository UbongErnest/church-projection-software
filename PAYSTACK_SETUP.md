# Paystack Payment Integration - Production Implementation Guide

## Overview

This implementation provides a complete, production-ready Paystack payment integration with:
- Proper callback handling using `react-paystack`
- Backend verification with retry logic
- Webhook signature verification
- Database transaction logging
- Duplicate prevention

## Issues Fixed

### 1. Callback Error Fix
**Problem:** "Attribute callback must be a valid function"
**Solution:** 
- Using correct `react-paystack` import: `import { usePaystackPayment } from "react-paystack"`
- Callbacks (`onSuccess`, `onClose`) are now passed as functions in the `initializePayment()` call
- Never passing callback as string or executing immediately

### 2. Verification Failure Fix
**Problem:** Payment shows successful in Paystack but app says "Payment verification failed"
**Causes & Solutions:**
- **Timing issue:** Added 3-5 retry attempts with 1.5s delays
- **Missing webhook:** Implemented proper webhook handler with HMAC signature verification
- **Network delays:** Added exponential backoff for verification retries
- **Invalid reference:** Added validation before verification call

## File Changes

### New Files
1. `src/components/PaymentModal.tsx` - Popup-based payment component
2. `src/hooks/usePaystackPayment.ts` - React hook for payment handling
3. `db/schema.sql` - Database schema for transactions/subscriptions
4. `.env.example` - Environment variable template

### Modified Files
1. `src/server/payments.ts` - Enhanced with transaction logging
2. `server.ts` - Added webhook endpoint with HMAC verification
3. `package.json` - Added `react-paystack` dependency
4. `src/vite-env.d.ts` - Added TypeScript types for Paystack
5. `src/types.ts` - Added payment types

## Environment Variables Required

```bash
# Frontend (Vercel/Netlify)
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxx

# Backend (Supabase/functions or server)
PAYSTACK_SECRET_KEY=sk_test_xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
APP_URL=https://your-domain.com
```

## Paystack Setup

### 1. Install Package
```bash
npm install react-paystack
```

### 2. Configure Webhook URL
In Paystack Dashboard:
- Go to Settings > Webhooks
- Add URL: `https://your-domain.com/api/webhook/paystack`
- Select event: `charge.success`

### 3. Run Database Schema
Execute `db/schema.sql` in Supabase SQL editor

## Payment Flow

```
1. User clicks payment button
   ↓
2. PaymentModal opens with plan details
   ↓
3. User clicks "Pay Now" → usePaystackPayment hook initializes popup
   ↓
4. User completes payment in Paystack popup
   ↓
5. Paystack calls onSuccess with reference
   ↓
6. Frontend calls /api/payment/verify
   ↓
7. Backend verifies with Paystack API (up to 5 retries)
   ↓
8. If verified: Update user subscription in database
   ↓
9. If webhook arrives: Double-check subscription activation
```

## Common Mistakes Checklist

- [ ] ✅ Never use string for callback - use function reference
- [ ] ✅ Never call `initializePayment(onSuccess())` - use `initializePayment({ onSuccess })`
- [ ] ✅ Never trust frontend success alone - always verify on backend
- [ ] ✅ Use correct amount in kobo (multiply by 100)
- [ ] ✅ Verify webhook signature with HMAC SHA512
- [ ] ✅ Prevent duplicate transactions with unique reference constraint
- [ ] ✅ Handle pending status with retry logic
- [ ] ✅ Use service_role key only on backend (never expose)
- [ ] ✅ Validate reference format before verification
- [ ] ✅ Check amount matches expected value
- [ ] ✅ Validate customer email matches

## Testing

### Test Mode
Use test keys: `pk_test_xxx` and `sk_test_xxx`

### Test Cards
- Success: `4000 0000 0000 0000` / `0000`
- Failure: `4000 0000 0000 0069` / `0000`

## Deployment Checklist

1. Set environment variables in Vercel/Supabase
2. Run database schema migration
3. Configure webhook URL in Paystack Dashboard
4. Test payment flow in development mode
5. Switch to live keys for production
6. Verify webhook endpoint is accessible

## Security Notes

- Webhook signature verification prevents fake requests
- Secret key never exposed to frontend
- Transaction amounts validated on backend
- Duplicate reference prevention via database constraint
- User ID validated from Paystack metadata