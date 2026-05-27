import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://opwwrsenbspunkmeqnvo.supabase.co";
const supabaseAnonKey = "sb_publishable_ro9MOv6_fIdjaNL5xPXgtA_PuMzu2ZQ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserProfile = {
  user_id: string;
  email: string;
  display_name: string;
  created_at: string;
  church_name: string;
  country: string;
  state: string;
  city: string;
  location: string;
  denomination: string;
  phone?: string;
  subscription_plan: "free" | "monthly" | "yearly";
  subscription_status: string;
  subscription_end?: string;
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

export function mapProfileFromDB(dbProfile: any): any {
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
    phone: dbProfile.phone || "",
    subscriptionPlan: dbProfile.subscription_plan,
    subscriptionStatus: dbProfile.subscription_status,
    subscriptionEnd: dbProfile.subscription_end,
  };
}
