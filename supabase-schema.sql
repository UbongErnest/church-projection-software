CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL,
  church_name TEXT NOT NULL,
  country TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  location TEXT NOT NULL,
  denomination TEXT NOT NULL,
  subscription_plan TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS sermon_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  raw_date BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sermon_notes ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid()::text = user_id);

-- Sermon notes policies
CREATE POLICY "Users can view their own notes" ON sermon_notes
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own notes" ON sermon_notes
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own notes" ON sermon_notes
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own notes" ON sermon_notes
  FOR DELETE USING (auth.uid()::text = user_id);
