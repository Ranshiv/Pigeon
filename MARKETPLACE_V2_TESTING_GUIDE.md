# Marketplace V2 Testing Guide

This guide details step-by-step instructions to verify the **Database Persistence** and **Code Generation** features.

## Prerequisites

1.  **Ensure MongoDB is Running**: Your local MongoDB instance must be active.
2.  **Seed the Database**: If you haven't already, populate the database with the initial API catalog.
    ```bash
    node scripts/seedMarketplace.js
    ```
    *Expected Output:* `Connected to MongoDB` -> `Cleared existing marketplace APIs` -> `Successfully inserted X APIs` -> `Done!`

3.  **Start the Application**:
    *   **Server**: `npm start` (in root directory)
    *   **Client**: `cd client && npm start`

---

## Part 1: Verify Database Persistence (Explore Page)

**Goal**: Confirm that API data is being loaded from MongoDB and that search/filter operations work.

1.  **Navigate to Marketplace**:
    *   Open your browser to `http://localhost:3000/workspace/explore`.
    *   *Verification*: You should see a list of APIs (OpenWeatherMap, GitHub, etc.). These are now coming from your database, not a hardcoded file.

2.  **Test Search**:
    *   Type `weather` in the search bar.
    *   *Verification*: The list should filter down to "OpenWeatherMap". This confirms the MongoDB text search index is working.

3.  **Test Category Filtering**:
    *   Click the **Filters** button to open the sidebar.
    *   Click on the **Development** category.
    *   *Verification*: You should see APIs like "JSONPlaceholder" and "GitHub".

4.  **Test Tags**:
    *   Click on a tag like `cryptocurrency` (if available) or search for `coin`.
    *   *Verification*: The results should update accordingly.

---

## Part 2: Verify Code Generation (Try It Console)

**Goal**: Confirm that you can generate and copy code snippets for API requests.

1.  **Select an API**:
    *   From the Explore page, click on **OpenWeatherMap** (or any API).
    *   The API Detail Modal will open.

2.  **Open Try It Console**:
    *   Click on the **Try It** tab in the modal.

3.  **View Code Snippet**:
    *   Locate the action buttons below the Request Builder.
    *   Click the **View Code** button (it has a `< />` icon).
    *   *Verification*: A code block should appear below the buttons, showing a `cURL` command by default.

4.  **Test Dynamic Updates**:
    *   In the **Query Parameters** section, type `London` into the value field for the `q` parameter.
    *   *Verification*: Look at the code snippet. It should instantly update to include `?q=London`.
    *   Check **Headers**: Add a new header (e.g., `Test-Header: 123`). The code snippet should explicitly add `-H "Test-Header: 123"`.

5.  **Test Language Switching**:
    *   Use the dropdown menu above the code block to switch from **cURL** to **JavaScript (Fetch)**.
    *   *Verification*: The code should change to a `fetch('https://...', options)` syntax.
    *   Try **Python (Requests)**.
    *   *Verification*: The code should change to python code using the `requests` library.

6.  **Test Copy Functionality**:
    *   Click the **Copy** icon (clipboard) next to the language dropdown.
    *   *Verification*: The icon should briefly change to a checkmark, indicating the code is in your clipboard. Paste it into a text editor to confirm.

---

## Troubleshooting

- **No APIs showing?**
    - Check your server console. If you see database connection errors, ensure MongoDB is running.
    - Run the seed script again: `node scripts/seedMarketplace.js`.
- **Code Generation Blank?**
    - Ensure you are on the "Try It" tab.
    - If the "View Code" button does nothing, check the browser console (F12) for any React errors.
