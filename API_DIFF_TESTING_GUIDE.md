# API Diff Testing Guide

## 🧪 How to Test the Contract Diff & Breaking Changes Feature

### Current Status ✅
- **Fixed**: Hardcoded "0" values issue
- **Working**: Shows "Versions Are Identical" for identical specs
- **Backend**: API diff logic working correctly

### Test Scenarios

#### 1. **Identical Versions (✅ Currently Working)**
**What you see:** "Versions Are Identical" message
**Expected behavior:** 
- No hardcoded "0" values
- Clean message explaining versions are the same
- 100% compatibility badge

#### 2. **Non-Breaking Changes Test**
**Steps to create:**
1. In Visual API Designer, create a simple API:
   ```
   GET /users - returns user list
   POST /users - creates a user
   ```
2. Save as Version "v1.0"
3. Add new endpoints (non-breaking):
   ```
   GET /users/{id} - get specific user
   GET /health - health check
   ```
4. Save as Version "v1.1"
5. Compare v1.0 → v1.1

**Expected results:**
- Total Changes: 2+
- Breaking Changes: 0
- Safe Changes: 2+
- Compatibility: 100% (no breaking changes)

#### 3. **Breaking Changes Test**
**Steps to create:**
1. Start with v1.0 from above
2. Remove the POST /users endpoint
3. Change GET /users to require authentication parameter
4. Save as Version "v2.0"
5. Compare v1.0 → v2.0

**Expected results:**
- Total Changes: 2+
- Breaking Changes: 1-2
- Safe Changes: 0+
- Compatibility: <100% (due to breaking changes)

#### 4. **Mixed Changes Test**
**Steps to create:**
1. Start with v1.1 from scenario 2
2. Add new optional endpoint: GET /stats
3. Remove GET /health endpoint  
4. Save as Version "v1.2"
5. Compare v1.1 → v1.2

**Expected results:**
- Total Changes: 2
- Breaking Changes: 1 (removed endpoint)
- Safe Changes: 1 (added endpoint)
- Compatibility: ~80% (some breaking changes)

### 🎯 Quick Manual Test

**To quickly verify it's working:**

1. **Navigate to API Designer**
2. **Click the "Diff" tab** (Contract Diff & Breaking Changes)
3. **Create two identical versions:**
   - Save current design as "Test v1"
   - Make no changes
   - Save again as "Test v2"
4. **Compare Test v1 vs Test v2**
   - Should show "Versions Are Identical"
   - Should NOT show hardcoded "0" values

5. **Create different versions:**
   - Modify the design (add/remove endpoints)
   - Save as "Test v3"
   - Compare Test v1 vs Test v3
   - Should show actual diff statistics

### 🐛 What to Look For

#### ✅ Fixed Issues:
- No more hardcoded "0, 0, 0, 100%" cards
- Clean "Versions Are Identical" message for same versions

#### ⚠️ Potential Issues to Watch:
- Empty comparison results returning null
- Backend API returning incorrect diff data
- Frontend not refreshing after version selection

### 🔧 Debugging Tips

If you see issues:

1. **Check Browser Console** for API errors
2. **Verify Version Selection** - ensure both dropdowns have selections
3. **Check Network Tab** - look for failed API calls to `/api/api-versions/versions/{id1}/compare/{id2}`
4. **Clear Browser Cache** if changes don't appear

### 📊 Expected API Response Format

The backend should return:
```json
{
  "summary": {
    "totalChanges": 0,
    "breakingChanges": 0,
    "nonBreakingChanges": 0,
    "addedEndpoints": 0,
    "removedEndpoints": 0,
    "modifiedEndpoints": 0
  },
  "hasBreakingChanges": false,
  "changes": [],
  "changelog": "# API Specification Diff Report...",
  "format": "json"
}
```

### 🎉 Success Indicators

✅ **Identical versions**: Shows custom message instead of "0" values
✅ **Different versions**: Shows actual calculated statistics  
✅ **Breaking changes**: Properly flagged and counted
✅ **Non-breaking changes**: Properly identified
✅ **Mixed scenarios**: Both types detected correctly
