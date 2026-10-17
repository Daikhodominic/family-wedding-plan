// Connection details for the family's Supabase project.
// The publishable key is meant to be public: what people can see and change
// is enforced by the database rules in supabase/setup.sql.
export const SUPABASE_URL = 'https://gkedbgcrgrzlfrxhrkdv.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Rhuu-ALFLdDaBNo5liJ1Ew_V5kWhGbY';

// 'live' talks to Supabase. 'demo' keeps everything in this browser only,
// with sample data — used for previews. Add ?demo to the address to force it.
export const MODE = (window.FWP_MODE === 'demo' || /[?&]demo\b/.test(location.search)) ? 'demo' : 'live';
