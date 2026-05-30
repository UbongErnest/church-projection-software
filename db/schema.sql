-- Supabase Database Schema for Church Projection Software Payments
-- Run this in your Supabase SQL editor

-- Enable pgcrypto extension for UUID generation (if not already enabled)
create extension if not exists "pgcrypto";

-- Users table (extends existing)
alter table users 
add column if not exists subscription_plan text default 'free' check (subscription_plan in ('free', 'monthly', 'yearly')),
add column if not exists subscription_status text default 'active' check (subscription_status in ('active', 'expired', 'cancelled')),
add column if not exists subscription_end timestamptz,
add column if not exists subscription_start timestamptz;

-- Transactions table - records all payment transactions
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  user_id text not null references users(user_id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  amount integer not null,
  currency text default 'NGN',
  status text default 'pending' check (status in ('pending', 'success', 'failed', 'abandoned')),
  flutterwave_status text,
  email text,
  metadata jsonb,
  created_at timestamptz default now() not null,
  verified_at timestamptz,
  webhook_received_at timestamptz,
  updated_at timestamptz default now()
);

-- Create index on reference for fast lookups
create index if not exists idx_transactions_reference on transactions(reference);

-- Create index on user_id for user transaction history
create index if not exists idx_transactions_user_id on transactions(user_id);

-- Create index on created_at for analytics
create index if not exists idx_transactions_created_at on transactions(created_at);

-- Subscriptions table - stores active subscription records
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(user_id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  status text default 'active' check (status in ('active', 'cancelled', 'expired')),
  started_at timestamptz default now() not null,
  ends_at timestamptz,
  cancelled_at timestamptz,
  reference text,
  amount integer,
  currency text default 'NGN',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now()
);

-- Create index on user_id for fast lookups
create index if not exists idx_subscriptions_user_id on subscriptions(user_id);

-- Create index on ends_at for expiration checks
create index if not exists idx_subscriptions_ends_at on subscriptions(ends_at);

-- Webhook event logs table
create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  reference text,
  payload jsonb,
  signature_verified boolean default false,
  processed boolean default false,
  processed_at timestamptz,
  error text,
  created_at timestamptz default now() not null
);

-- Create index on reference for fast lookups
create index if not exists idx_webhook_events_reference on webhook_events(reference);

-- Create index on event_type for filtering
create index if not exists idx_webhook_events_type on webhook_events(event_type);

-- Enable Row Level Security (RLS) on transactions table
alter table transactions enable row level security;

-- Enable RLS on subscriptions table
alter table subscriptions enable row level security;

-- Enable RLS on webhook_events table
alter table webhook_events enable row level security;

-- Policy: Users can only see their own transactions
DROP POLICY IF EXISTS users_can_view_own_transactions ON transactions;
CREATE POLICY users_can_view_own_transactions ON transactions FOR SELECT USING (auth.uid()::text = user_id);

-- Policy: Users can only see their own subscriptions
DROP POLICY IF EXISTS users_can_view_own_subscriptions ON subscriptions;
CREATE POLICY users_can_view_own_subscriptions ON subscriptions FOR SELECT USING (auth.uid()::text = user_id);

-- Policy: Service role can manage all tables (needed for edge functions/webhooks)
-- Note: The service_role key bypasses RLS by default

-- Function to update updated_at timestamp
create or replace function update_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger for transactions table
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger for subscriptions table
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Grant permissions to authenticated users
grant select, insert, update on transactions to authenticated;
grant select, insert, update on subscriptions to authenticated;
grant select on webhook_events to authenticated;

-- Grant all permissions to service_role (for backend)
grant all on transactions to service_role;
grant all on subscriptions to service_role;
grant all on webhook_events to service_role;

--okay--