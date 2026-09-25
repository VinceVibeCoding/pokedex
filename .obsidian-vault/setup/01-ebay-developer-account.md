# Step 1 — Create the eBay Developer Account & get EBAY_APP_ID

Takes ~10 minutes. No approval wait for basic API access.

## 1.1 Register
1. Go to https://developer.ebay.com and click **Register** (or **Sign In** if you already have an eBay account — you can reuse it).
2. Fill in the developer profile (name, email). Accept the API License Agreement.
3. You land on the **Developer Dashboard** (https://developer.ebay.com/my/keys).

## 1.2 Create an App (keyset)
1. On the dashboard, under **Application Keys**, click **Create an App** (or "Get your App ID").
2. Choose **Production** environment (Sandbox is for testing sell-side flows; we need production sold data).
3. Name it e.g. `pokecard-index`.
4. eBay generates a keyset with:
   - **App ID (Client ID)** — looks like `YourName-pokecard-PRD-xxxxxxxxxxxx-xxxxxxxx` ← **this is your `EBAY_APP_ID`**
   - Dev ID and Cert ID (Client Secret) — keep the Cert ID handy too; some flows need it.

## 1.3 Save the keys
Copy the App ID and Cert ID somewhere safe (password manager). You'll paste them into the project `.env` in [step 3](03-configure-app.md).

## Notes & gotchas
- **Rate limits:** the Finding API allows ~5,000 calls/day on a free production keyset — plenty for hundreds of cards on a daily cron.
- **Do not commit keys** to git. `.env` is already gitignored in this project.
- One eBay developer account supports multiple apps; you can make separate keysets for dev/prod later.

➡️ Next: [02-ebay-api-access.md](02-ebay-api-access.md)
