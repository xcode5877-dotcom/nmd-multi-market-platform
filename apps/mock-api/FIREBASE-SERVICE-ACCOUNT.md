# Firebase Admin service account (for FCM on the server)

The file `firebase-service-account.json` in this folder must be the **Firebase Admin SDK service account key**, not the Android `google-services.json`.

- **Android app** uses: `google-services.json` (has `project_info`, `client`, etc.) — that goes in the Merchant Android project.
- **Server (mock-api)** uses: **Service account key** JSON with:
  - `"type": "service_account"`
  - `"project_id": "now-market-9eebb"`
  - `"private_key_id"`, `"private_key"`, `"client_email"`, `"client_id"`, etc.

**How to get the correct file**

1. Open [Firebase Console](https://console.firebase.google.com/) → project **now-market-9eebb**.
2. Project settings (gear) → **Service accounts**.
3. Click **Generate new private key** and download the JSON.
4. Save it as `apps/mock-api/firebase-service-account.json` (overwrite the current file).

**On the server:** Upload the same JSON file to the server at this path (relative to the repo root):

- **Path:** `apps/mock-api/firebase-service-account.json`

`docker-compose.yml` mounts this file into the mock-api container as `/app/firebase-service-account.json` and sets `FIREBASE_SERVICE_ACCOUNT_PATH` so FCM works after `docker compose restart mock-api`.

Then restart mock-api and run the test-fcm again. You should see either "Sent successfully" or "Invalid Token" (dummy token), which means Firebase Admin is connected.
