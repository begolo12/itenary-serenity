# Firebase Setup

Firebase SDK and Firebase CLI are installed locally in this workspace.

## Connect a Firebase project

1. Authenticate the local CLI:

   ```powershell
   npm.cmd run firebase:login
   ```

2. Select an existing project:

   ```powershell
   npm.cmd run firebase:use
   ```

3. In Firebase Console, register a Web App and copy its config values into `.env.local` using `.env.example` as the template.

4. Enable Authentication providers and create Firestore in Firebase Console. Firebase Storage is intentionally not used by this project.

5. Deploy the initial Firestore rules and indexes:

   ```powershell
   npm.cmd run firebase:deploy
   ```

## Local emulators

Set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` in `.env.local`, then run:

```powershell
npm.cmd run firebase:emulators
```

The Emulator UI is available at `http://127.0.0.1:4000`.

## Security note

The Firebase Web API key is an application identifier and is expected in the frontend config. DeepSeek or other AI provider API keys must never use `NEXT_PUBLIC_*`; store encrypted credentials through a trusted Cloud Function using Cloud KMS or Secret Manager.

## Photos without Firebase Storage

Trip photos are converted in the browser to WebP and compressed to at most 300 KB before being saved as Base64 in `workspaces/{workspaceId}/trips/{tripId}/photos/{photoId}`. Base64 adds size overhead, so each photo should remain below about 410,000 characters and must be stored as its own document.

This approach is appropriate for small cover images or compressed documentation photos. It is not suitable for original-resolution images, video, or large galleries because Firestore documents are limited to 1 MiB and reads are billed per document.

Use `compressPhotoForFirestore(file)` from `src/lib/image-compression.js` before writing a photo document. Save its returned fields together with `createdAt: serverTimestamp()` and `createdBy: auth.currentUser.uid`; the deployed rules reject photos above the limit or in another format.
