# Feature 2: Request Reviews - Complete Testing Guide

## Overview
This guide provides detailed step-by-step instructions for testing the "Request Reviews" collaboration feature.

## Prerequisites

### Required Setup
- Both **frontend** (port 3000) and **backend** (port 5001) servers must be running
- At least **one registered user account** (two recommended for full testing)

### Creating Multiple Test Accounts
To fully test the review workflow, you'll need two user accounts:

**Option 1: Two Different Browsers**
- Browser 1: Chrome (User A - "Ranshiv")
- Browser 2: Firefox (User B - "Cooldude")

**Option 2: Incognito/Private Windows**
- Window 1: Normal browsing (User A)
- Window 2: Incognito/Private mode (User B)

**Option 3: Solo Testing**
- Use a single account and select "(Self)" as the reviewer
- This allows you to test the full workflow alone

---

## Step-by-Step Testing Instructions

### Part 1: Create and Save a Request (User A)

#### Step 1: Navigate to New Request Page
1. Log in as **User A**
2. Click **"API Network"** in the top navigation bar
3. Click **"New Request"** or navigate directly to: `http://localhost:3000/workspace/api-network/requests/new`

**✅ Verify**: You see a blank request form with URL input, method dropdown, and tabs for params/headers/body

---

#### Step 2: Fill in Request Details
1. **URL**: Enter `https://jsonplaceholder.typicode.com/users`
2. **Method**: Select `GET` from the dropdown
3. **Request Name**: The title should show "New Request" (this will be auto-named on save)

**Optional**: Add query parameters or headers if you want
- Click the "Params" tab to add query parameters
- Click the "Headers" tab to add custom headers

**✅ Verify**: You can type in the URL field and select different HTTP methods

---

#### Step 3: Save the Request
1. Locate the **"Save"** button in the top right of the request form
2. Click **"Save"**
3. Wait for the redirect

**✅ Verify**: 
- The page redirects to a URL like: `/workspace/api-network/requests/[REQUEST_ID]`
- You now see the **full Request Workspace** interface
- The collaboration toolbar is visible at the top with green "Request Review" button

**⚠️ Troubleshooting**:
- If nothing happens: Check browser console for errors, ensure backend is running
- If you see "Failed to save": Check that the backend is running on port 5001

---

### Part 2: Request a Review (User A)

#### Step 4: Open the Request Review Modal
1. On the saved request page, look for the **"Request Review"** button
   - Location: Top right of the page, green button in the collaboration toolbar
2. Click **"Request Review"**

**✅ Verify**: A modal dialog opens with the title "Request Review"

**⚠️ Troubleshooting**:
- If you don't see the button: Make sure you saved the request first (Step 3)
- If nothing happens on click: Check browser console for JavaScript errors

---

#### Step 5: Select Reviewer(s)
1. Look at the **"Reviewers"** dropdown in the modal
2. Click on the dropdown to open the list of users

**✅ Verify**: You should see:
- Other registered users in the system (if any)
- Your own name with **(Self)** appended
- Example: "Ranshiv Kumar (Self)", "Cooldude", etc.

3. Select a reviewer:
   - **For two-user testing**: Select "User B" (e.g., "Cooldude")
   - **For solo testing**: Select yourself "(Self)"
   - **For multiple reviewers**: Hold `Ctrl` (Windows/Linux) or `Cmd` (Mac) and click multiple names

**⚠️ Troubleshooting**:
- If dropdown is empty or only shows "(Self)":
  - Make sure you have created a second user account
  - Check browser console - should log "Fetched users: [array]"
  - Check backend logs - should show "Fetching user list..." and "Found X users"
- If fetch fails:
  - Ensure backend is running
  - Check `/api/auth/users/list` endpoint is accessible

---

#### Step 6: Fill in Review Details
1. **Title**: Auto-filled (e.g., "Review for New Request")
   - You can edit this if needed
2. **Description**: Add notes for the reviewer
   - Example: "Please check if the API endpoint is correct and headers are properly set"

**✅ Verify**: You can type in both text fields

---

#### Step 7: Submit the Review Request
1. Click the **"Send Request"** button at the bottom right of the modal
2. Wait for confirmation

**✅ Verify**: 
- Alert popup appears: "Review request sent!"
- The modal closes automatically
- You're back to the request edit page

**⚠️ Troubleshooting**:
- If you see "Failed to send review request":
  - Check backend is running
  - Open browser console and network tab for specific error
  - Verify you selected at least one reviewer

---

### Part 3: View and Respond to Review (User B or Self)

#### Step 8: Navigate to Reviews Dashboard
1. **If testing with User B**: 
   - Switch to Browser/Window 2
   - Make sure User B is logged in
2. **If solo testing**: Stay in the same session

3. In the top navigation bar, click **"Reviews"** (clipboard icon)

**✅ Verify**: 
- URL changes to: `http://localhost:3000/workspace/reviews`
- You see the **Reviews Dashboard** with two tabs:
  - "Assigned to Me"
  - "Created by Me"

**⚠️ Troubleshooting**:
- If you don't see "Reviews" link: Check that Navbar.js was properly updated
- If page is blank: Check browser console for errors

---

#### Step 9: Find Your Assigned Review
1. Click the **"Assigned to Me"** tab
2. Look for the review request from User A

**✅ Verify**: 
- You see a review item in the list
- The review shows:
  - Title: "Review for New Request" (or your custom title)
  - Status: "open" or "pending"
  - Requester: User A's name
  - Created date/time

**⚠️ Troubleshooting**:
- If list is empty with "No reviews found":
  - Make sure you completed Steps 1-7
  - Check you're logged in as the correct user (the one you selected as reviewer)
  - Check backend logs to verify the review was created
  - Try clicking "Created by Me" tab to see if review appears there

---

#### Step 10: Approve or Reject the Review
1. Look for **"Approve"** and **"Changes Requested"** (or "Reject") buttons on the review item
2. Click your choice:
   - **Approve**: If the request looks good
   - **Changes Requested**: If there are issues

**Note**: The exact UI may vary based on implementation. You might need to:
- Click on the review item to expand it first
- Look for action buttons in a dropdown menu
- Click "View Details" before seeing approve/reject options

**✅ Verify**: 
- Status updates to "approved" or "rejected"
- Confirmation message appears
- The review item reflects the new status

**⚠️ Troubleshooting**:
- If buttons don't appear: The ReviewDashboard may need additional UI implementation
- Check if you need to click on the review item first
- Look for console errors

---

### Part 4: Verify Review Status (User A)

#### Step 11: Check Review Status as Creator
1. **If testing with two users**: Switch back to Browser/Window 1 (User A)
2. Navigate to the **Reviews Dashboard** (click "Reviews" in nav)
3. Click the **"Created by Me"** tab

**✅ Verify**: 
- You see your review request in the list
- Status shows "approved" or "rejected" (based on User B's action)
- The reviewer's name is displayed
- Updated timestamp is shown

**⚠️ Troubleshooting**:
- If status hasn't updated: Refresh the page
- If you don't see the review: Check you're on "Created by Me" tab, not "Assigned to Me"

---

## Success Criteria

You have successfully tested Feature 2 if:

✅ You can create and save an API request  
✅ The "Request Review" button appears on saved requests  
✅ The reviewer dropdown shows all registered users  
✅ You can select reviewers and submit a review request  
✅ The review appears in "Assigned to Me" for the reviewer  
✅ The reviewer can approve/reject the review  
✅ The status updates and appears in "Created by Me" for the requester  

---

## Common Issues and Solutions

### Issue: "Save button not working"
**Solution**: This was fixed in recent updates. Make sure:
- Backend is running
- `APINetworkSection.js` includes `onCreateRequest` prop
- Frontend has auto-reloaded after code changes

### Issue: "Can't see other users in reviewer dropdown"
**Solution**: 
- Ensure you have created multiple user accounts (login with different Google accounts or browsers)
- Check browser console logs for "Fetched users:" message
- Check backend logs for "Found X users" message
- Verify `/api/auth/users/list` endpoint is working

### Issue: "Reviews dashboard is empty"
**Solution**:
- Make sure you completed the "Submit Review Request" step successfully
- Check you're viewing the correct tab ("Assigned to Me" vs "Created by Me")
- Try refreshing the page
- Check backend `/api/reviews` endpoint for data

### Issue: "Request Review button not visible"
**Solution**:
- Ensure you **saved** the request first (not just a "New Request")
- Check that `RequestWorkspace` is rendering (not the old `RequestDetails` text-only view)
- The button is in the top toolbar, green color, on the right side

---

## Next Steps

Once Feature 2 is working:
- Test **Feature 3: Inline Comments** (adding comments on specific parts of the request/response)
- Test **Feature 4: Activity Feed** (viewing all team activities)
- Test **Feature 5: Video & Voice Calling** (WebRTC-based collaboration)

---

## Technical Details (For Debugging)

### API Endpoints Used
- `GET /api/auth/users/list` - Fetch all users for reviewer selection
- `POST /api/reviews` - Create a new review request
- `GET /api/reviews?type=assigned` - Get reviews assigned to current user
- `GET /api/reviews?type=created` - Get reviews created by current user
- `PATCH /api/reviews/:id/status` - Update review status (approve/reject)

### Key Components
- `ReviewRequestModal.js` - Modal for creating reviews
- `ReviewDashboard.js` - Dashboard for viewing/managing reviews
- `RequestWorkspace.js` - Main request editor with collaboration toolbar
- `Navbar.js` - Contains "Reviews" navigation link

### Data Flow
1. User A saves request → Request ID generated
2. User A opens modal → Fetches users from `/api/auth/users/list`
3. User A submits review → POST to `/api/reviews` with `{ resourceId, reviewers, title, description }`
4. User B views dashboard → GET `/api/reviews?type=assigned`
5. User B approves → PATCH `/api/reviews/:id/status` with `{ status: 'approved' }`
6. User A checks status → GET `/api/reviews?type=created`
