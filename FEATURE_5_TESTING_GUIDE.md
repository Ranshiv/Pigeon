# Feature 5: Video & Voice Calling Testing Guide

This guide details how to verify the **Real-time Video & Voice Calling** functionality in Pigeon.

## Prerequisites

*   **Two Different Users**: You need two separate accounts to test calling.
*   **Two Browser Windows**: Use one normal window and one **Incognito/Private** window (or two different browsers) to simulate two users.
*   **Microphone/Camera Permissions**: You **MUST allow** browser permissions for camera and microphone when prompted.

---

## Step-by-Step Testing Flow

### 1. Setup - Users in the Same Room
1.  **User A (Window 1)**: Login and navigate to a specific Workspace (e.g., "Team Workspace").
2.  **User B (Window 2)**: Login (as a different user) and navigate to the **SAME** Workspace.
3.  **Verify Presence**:
    *   Look for the **Users Icon** (👤) on the right side of the screen (below the Activity Feed toggle).
    *   Click it to open the **Online Users** panel.
    *   You should see both "User A (You)" and "User B" listed.

### 2. Initiating a Call
1.  **User A**: In the **Online Users** panel, find **User B**.
2.  **User A**: Click the green **Video Icon** (📹) next to User B's name.
3.  **Permission Check**: If this is your first time, the browser will ask for Camera/Microphone access. Click **Allow**.
4.  **Observation**: User A should see their own video preview in a small window (box).

### 3. Receiving a Call
1.  **User B**: Look at your screen. You should see an **"Incoming Call..."** popup in the bottom right corner.
2.  **User B**: Click the green **"Answer"** button.
3.  **Permission Check**: User B must also Click **Allow** for Camera/Microphone access.

### 4. Live Call Verification
1.  **Both Users**:
    *   Should see the **Video Chat Overlay** in the bottom right.
    *   **Main Video**: Should show the *other* person.
    *   **Small Video (PiP)**: Should show *yourself*.
    *   **Audio**: Verify you can hear audio (if testing on same machine, you might hear feedback/echo - this is normal for local testing).

### 5. Ending the Call
1.  **User A (or B)**: Click the red **"End Call"** button on the overlay.
2.  **Verification**:
    *   The video overlay should disappear for the user who ended it.
    *   The other user's page might reload or the call overlay will close (checking disconnection logic).

---

## Troubleshooting

### "I don't see the Users Icon"
*   Ensure you are in a valid **Workspace** URL (e.g., `/workspace/workspaces/123`).
*   Refresh the page to reconnect to the collaboration server.

### "Call Failed" or Video is Black
*   **Localhost**: WebRTC works on `localhost`, but if you are testing across a network, you need HTTPS.
*   **Permissions**: Did you accidentally block camera access? Check browser settings.
*   **Simple-Peer Error**: If you see errors in console about `process` or `Buffer`, the polyfills might be missing. We fixed this in `craco.config.js`, so ensure you restarted the server.

### "Echo / Feedback Loop"
*   This happens when testing two users on the same computer without headphones.
*   **Fix**: Mute your system volume or use headphones.

### "I can't see the other user in the list"
*   Ensure both users are in the **exact same workspace URL**.
*   The system uses the URL path to define the "Room".

---

## Technical Debugging

If the call fails to connect, check the **Browser Console (F12)**:
*   Look for `socket.emit('callUser')` logs.
*   Look for `simple-peer` errors.
*   Verify `ICE Connection Status`.
