# Step 2 — Enable API access & verify with a test call

We use eBay's **Finding API** (`findCompletedItems`) — it returns completed/sold listings, which is exactly what comps are.

## 2.1 Confirm the Finding API is available
The Finding API is enabled by default on production keysets — no extra signup. Full reference: https://developer.ebay.com/devzone/finding/CallRef/findCompletedItems.html

## 2.2 Test call (do this before touching the codebase)
Replace `YOUR_APP_ID` with the App ID from step 1 and run:

```bash
curl -s "https://svcs.ebay.com/services/search/FindingService/v1\
?OPERATION-NAME=findCompletedItems\
&SERVICE-VERSION=1.0.0\
&SECURITY-APPNAME=YOUR_APP_ID\
&RESPONSE-DATA-FORMAT=JSON\
&REST-PAYLOAD\
&keywords=Charizard%20Base%20Set%20PSA%209\
&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true\
&paginationInput.entriesPerPage=5"
```

## 2.3 What success looks like
- JSON response with `findCompletedItemsResponse → searchResult → item[]`
- Each item has `title`, `sellingStatus.currentPrice`, `listingInfo.endTime`
- `ack: "Success"`

## 2.4 Common errors
| Error | Cause | Fix |
|---|---|---|
| `Invalid application ID` | Typo in App ID / used Dev ID by mistake | Recopy the **App ID (Client ID)** |
| `ack: "Failure"` + `50001` | Keyset disabled or wrong environment | Check the dashboard shows Production keys active |
| Empty `item[]` | `SoldItemsOnly` filter + too-specific keywords | Broaden keywords (the adapter handles filtering) |

## 2.5 Relevant filters we will use in the adapter
- `SoldItemsOnly=true` — completed sales only
- `keywords` — card name + set + optional grade ("PSA 9")
- `sortOrder=EndTimeSoonest` reversed → most recent sales
- `paginationInput` — page through results (max 100/page)

➡️ Next: [03-configure-app.md](03-configure-app.md)
