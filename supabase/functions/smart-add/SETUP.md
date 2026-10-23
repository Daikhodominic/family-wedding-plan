# Setting up Smart add's AI (optional)

Smart add works without any of this: its fixed rules read phone numbers, prices, Instagram handles, links,
dates and the kind of vendor from anything pasted. Setting up the AI adds reading of **screenshots**,
**websites** and **Instagram business profiles**.

Every key goes into **Supabase → Edge Functions → Secrets**. Never paste a key into the app or into a chat.

## 1. Gemini, the free main AI (about 5 minutes)
1. Go to <https://aistudio.google.com/apikey> and sign in with a Google account.
2. Click **Create API key** and copy it.
3. In Supabase: **Edge Functions → Secrets → Add new secret**. Name: `GEMINI_API_KEY`. Value: the key you copied.

The free tier is plenty for a family.

## 2. Deploy the function (once)
**From the Supabase dashboard:** go to **Edge Functions → Deploy a new function → Via editor**.
- Name it `smart-add`.
- Paste in the contents of `supabase/functions/smart-add/index.ts`.
- Click **Deploy**.

**Or, with the Supabase CLI:**
```
supabase functions deploy smart-add
```

## 3. Cloudflare, the backup AI (optional)
Used only when Gemini doesn't answer.
1. Create a free account at <https://dash.cloudflare.com>.
2. Find your **Account ID** under **Workers & Pages → Overview**.
3. Under **My Profile → API Tokens → Create Token**, use the **Workers AI** template.
4. Add two secrets: `CF_ACCOUNT_ID` and `CF_API_TOKEN`.

## 4. Instagram business profiles (optional)
Instagram blocks other sites from reading its pages. Its official route is **Business Discovery**, which reads
any public **business or creator** profile: name, bio, website and recent photos. Personal accounts can't be
read this way. For those, send screenshots instead.

1. Turn your own Instagram into a free professional (**Creator** or **Business**) account and link it to a Facebook Page.
2. At <https://developers.facebook.com>, create an app of type **Business**. Add **Instagram Graph API** to it.
3. In the Graph API Explorer:
   - Get a token with `instagram_basic` and `pages_show_list`.
   - Exchange it for a long-lived token.
   - Find your Instagram user id with `me/accounts?fields=instagram_business_account`.
4. Add two secrets: `IG_USER_ID` (that id) and `IG_ACCESS_TOKEN` (the long-lived token). The token lasts about 60 days; refresh it when Smart add says Instagram can't be read.

## What goes where
- **Sent to the AI:** the pasted text (with tracking codes removed from links), the attached pictures, the websites' text, and the Instagram profile. It also gets the names of this wedding's steps, so it can pick where a vendor goes.
- **Never sent:** budgets, guest lists, family members' names or anything else from the plan.
- **Who can use it:** only signed-in family members. The function checks this.
- **What the AI is told:** to use only what it's given. It never searches a name on the web, so a different business with the same name can't get mixed in.
