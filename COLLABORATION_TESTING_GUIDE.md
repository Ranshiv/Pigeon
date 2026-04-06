# Collaboration Features Testing Guide

This guide outlines the steps to verify the newly implemented advanced collaboration features in Pigeon: **Shared Cursors**, **Review Requests**, **Inline Comments**, **Team Activity Feed**, and **Video/Voice Calling**.

## Prerequisites

1.  **Start the Backend Server**:
    ```bash
    cd c:\Users\ransh\OneDrive\Desktop\Pigeon
    node server.js
    ```
2.  **Start the Frontend Client**:
    ```bash
    cd c:\Users\ransh\OneDrive\Desktop\Pigeon\client
    npm start
    ```
3.  **Simulate Multiple Users**:
    *   Open **two different browsers** (e.g., Chrome and Edge) OR use **Incognito/Private mode** for the second session.
    *   Log in as **User A** in the first window.
    *   Log in as **User B** (or Guest) in the second window.
    *   Ensure both users join the *same* workspace or collection (if your app logic separates rooms by workspace).

---

## 1. Feature: Shared Cursors (Presence Awareness)

**Goal**: Verify that you can see where other users are working in real-time.

1.  **Setup**:
    *   Have User A and User B on the same page (e.g., the main Workspace Dashboard or a specific Request).
2.  **Action**:
    *   Move User A's mouse cursor around the screen.
3.  **Verification**:
    *   Look at User B's screen.
    *   **Success**: You should see a cursor labeled with User A's name moving in real-time corresponding to User A's movements.
    *   *Note: Cursors automatically fade out after inactivity.*

---

## 2. Feature: Request Reviews

**Goal**: Verify the formal workflow for peer reviewing API requests.

1.  **Create a Review Request (User A)**:
    *   Click **Save** on a "New Request" to create it.
    *   You will be redirected to the saved request view, which now shows the full **Request Workspace** (editor, response, and toolbar).
    *   Click the **"Request Review"** button (green button) in the top toolbar (top right).
    *   Select a reviewer (User B) from the dropdown, add a title/description, and submit.
2.  **Receive Request (User B)**:
    *   Check for a **Toast Notification** saying "New review request".
    *   Navigate to the **Review Dashboard** by clicking "Reviews" in the top navigation bar.
3.  **Approve/Reject (User B)**:
    *   Open the review item.
    *   Click **Approve** or **Changes Requested**.
4.  **Verify Status (User A)**:
    *   User A should receive a notification: "Review approved".
    *   The status of the request should reflect the approval.

---

## 3. Feature: Inline Comments

**Goal**: Verify adding context-specific comments on JSON data.

1.  **Add a Comment (User A)**:
    *   In `RequestWorkspace`, go to the **Body** or **Response** tab where JSON content is visible.
    *   Hover over a specific line or key in the JSON editor.
    *   Click the **Comment Icon** (or right-click -> Add Comment).
    *   Type: "Is this the correct data type?" and save.
2.  **View Comment (User B)**:
    *   Navigate to the same request.
    *   Verify that the specific line in the JSON is highlighted or has a marker.
    *   Click the marker to expand the thread and see User A's comment.
3.  **Reply/Resolve**:
    *   Types a reply: "Yes, it is."
    *   Click **"Resolve"** to close the thread.

---

## 4. Feature: Team Activity Feed

**Goal**: Verify the real-time log of team actions.

1.  **Observe Feed**:
    *   Open the **Activity Feed** sidebar (usually on the right side of the Workspace).
2.  **Perform Actions**:
    *   Create a new Request.
    *   Save changes to an existing Request.
    *   Post a comment.
3.  **Verification**:
    *   **Success**: New items should appear instantly in the Activity Feed list (e.g., *"User A updated 'Get Users' request"*, *"User B approved review 'Fix Auth Bug'"*).
    *   Check that timestamps are accurate ("Just now").

---

## 5. Feature: Video & Voice Calling

**Goal**: Test P2P communication for pair debugging.

*Note: The browser will ask for Camera/Microphone permissions. You MUST allow this.*

1.  **Initiate Call (User A)**:
    *   In the Workspace, look for the **User Avatar** of User B (usually in the active users list or top bar).
    *   Click the **Phone/Video Icon** next to their name.
    *   Permissions popup: Click **Allow**.
2.  **Receive Call (User B)**:
    *   User B sees an **Incoming Call Overlay** with User A's name.
    *   Click **"Accept"**.
3.  **In-Call**:
    *   **Success**: Both users should see each other's video stream (or hear audio).
    *   Test **Mute** and **Camera Off** toggles.
4.  **End Call**:
    *   Click the **Red Hangup Button**.
    *   Verify the overlay disappears for both users.

---

## Troubleshooting Common Issues

*   **Cursors not showing?** Ensure both users are connected to the same Socket.IO "room" (usually determined by the Workspace ID in the URL). Refresh both pages.
*   **"Call Failed"?** WebRTC sometimes fails on some networks (Create React App default) without a TURN server. Ensure you are testing on `localhost` or a secure HTTPS connection.
*   **Socket Disconnects?** Check the server terminal for connection logs (`userJoined`, `disconnect`).
*   **Module Errors?** If you see `process is not defined`, ensure you restarted the `npm start` server after the recent configuration changes.
