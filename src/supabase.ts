import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://opwwrsenbspunkmeqnvo.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ro9MOv6_fIdjaNL5xPXgtA_PuMzu2ZQ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  churchName: string;
  country: string;
  state: string;
  city: string;
  location: string;
  denomination: string;
  phone?: string;
  subscriptionPlan: "free" | "monthly" | "yearly";
  subscriptionStatus: string;
  subscriptionEnd?: string;
};

export type SavedSermonNote = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  timestamp: string;
  raw_date: number;
};

export function mapProfileFromDB(dbProfile: any): UserProfile | null {
  if (!dbProfile) return null;
  return {
    uid: dbProfile.user_id,
    email: dbProfile.email,
    displayName: dbProfile.display_name,
    createdAt: dbProfile.created_at,
    churchName: dbProfile.church_name,
    country: dbProfile.country,
    state: dbProfile.state,
    city: dbProfile.city,
    location: dbProfile.location,
    denomination: dbProfile.denomination,
    phone: dbProfile.phone,
    subscriptionPlan: dbProfile.subscription_plan,
    subscriptionStatus: dbProfile.subscription_status,
    subscriptionEnd: dbProfile.subscription_end,
  };
}
