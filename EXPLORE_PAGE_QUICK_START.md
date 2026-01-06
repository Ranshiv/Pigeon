# Explore Page - Quick Start Guide

## 🚀 Getting Started

### 1. Start the Backend Server
```bash
# Make sure MongoDB is running, then start the server
cd c:\Users\ransh\OneDrive\Desktop\Pigeon
node server.js
```

The server will start on `http://localhost:5001`

### 2. Start the React Client
```bash
# Open a new terminal
cd c:\Users\ransh\OneDrive\Desktop\Pigeon\client
npm start
```

The client will start on `http://localhost:3000`

### 3. Access the Explore Page

1. **Login to your workspace** at `http://localhost:3000`
2. Click on **"API Network"** in the navigation bar
3. Select **"Explore Public APIs"** from the dropdown
4. You'll be redirected to `/workspace/explore`

## 📖 Features Overview

### Search & Filter
- **Text Search**: Search by API name, description, provider, or tag
- **Category Filter**: Filter by Weather, Development, Data, Finance, Science, News
- **Tag Filter**: Click multiple tags to narrow results
- **Sort Options**: Sort by Most Popular, Highest Rated, or Name (A-Z)

### Explore APIs
- **10 Pre-loaded APIs** including:
  - OpenWeatherMap (Weather data)
  - GitHub REST API (Developer tools)
  - NASA APIs (Space & astronomy)
  - CoinGecko (Cryptocurrency)
  - JSONPlaceholder (Testing/mock data)
  - REST Countries (Geographic data)
  - And more...

### API Details
Click any API card to open the detail modal with 3 tabs:

1. **Overview**
   - Description and information
   - Base URL
   - Authentication type
   - Pricing
   - Tags
   - Documentation link

2. **Try It**
   - Interactive API testing console
   - Select endpoint from dropdown
   - Fill in path/query parameters
   - Add custom headers
   - Add request body (POST/PUT/PATCH)
   - Enter API key or OAuth token
   - Send request and view response
   - Save request to workspace

3. **Endpoints**
   - List of all available endpoints
   - Method badges (GET, POST, PUT, DELETE, PATCH)
   - Parameter details
   - Quick "Try" button

## 🧪 Testing an API

### Example: Test JSONPlaceholder API (No Auth Required)

1. **Open Explore page** (`/workspace/explore`)
2. **Find "JSONPlaceholder"** in the grid (or search for it)
3. **Click the card** to open details
4. **Go to "Try It" tab**
5. **Select endpoint**: "GET /posts" (default)
6. **Click "Send"** button
7. **View the response** with:
   - Status code (200 OK)
   - Response time
   - Headers
   - JSON body with posts

### Example: Test OpenWeatherMap API (Requires API Key)

1. **Get a free API key** from https://openweathermap.org/api
2. **Open Explore page**
3. **Click "OpenWeatherMap"** card
4. **Go to "Try It" tab**
5. **Select endpoint**: "GET /weather"
6. **Fill in Query Parameters**:
   - `q`: Enter "London"
   - `appid`: Paste your API key
   - `units`: Enter "metric" (optional)
7. **Click "Send"**
8. **View weather data** for London

## 💾 Saving Requests

After building a request in the Try It console:
1. Click **"Save Request"** button (green, at bottom)
2. Request is saved to your workspace
3. Access saved requests from Collections page
4. Can be run again anytime

## 🎨 Theme Support

The Explore page automatically adapts to your theme:
- **Light mode**: Blue primary color (#014C75)
- **Dark mode**: Adjusted colors for readability

Toggle theme in settings to see the change.

## 📱 Responsive Design

Works on all screen sizes:
- **Desktop**: Full layout with sidebar filters
- **Tablet**: Stacked layout
- **Mobile**: Single column, collapsible filters

## 🔧 Troubleshooting

### Issue: Can't see Explore link
**Solution**: Make sure you're logged in and click "API Network" dropdown

### Issue: APIs not loading
**Solution**: 
- Check backend is running on port 5001
- Check browser console for errors
- Verify `/api/marketplace/search` endpoint is accessible

### Issue: Proxy requests failing
**Solution**:
- Check internet connection
- Some APIs may have rate limits
- Verify API keys are correct
- Check CORS settings (proxy should handle this)

### Issue: Can't save requests
**Solution**:
- Make sure you're authenticated
- Check MongoDB is running
- Verify `/api/requests` endpoint works

## 🔑 API Keys for Testing

Here are some free APIs you can test immediately (no key required):
- ✅ **JSONPlaceholder** - No auth needed
- ✅ **REST Countries** - No auth needed
- ✅ **Random User Generator** - No auth needed
- ✅ **IP-API** - No auth needed

For APIs requiring keys:
- 🔑 **OpenWeatherMap** - Sign up at https://openweathermap.org/api
- 🔑 **GitHub** - Create token at https://github.com/settings/tokens
- 🔑 **NASA** - Get key at https://api.nasa.gov/
- 🔑 **NewsAPI** - Sign up at https://newsapi.org/
- 🔑 **CoinGecko** - Get key at https://www.coingecko.com/api

## 📚 Next Steps

1. **Try testing different APIs** to get familiar with the interface
2. **Save useful requests** to your collections
3. **Explore endpoint documentation** in the Endpoints tab
4. **Build workflows** by chaining saved requests
5. **Share with team** members in your workspace

## 🆘 Support

If you encounter issues:
1. Check server logs in terminal
2. Check browser console (F12)
3. Verify MongoDB connection
4. Check network tab for failed requests

---

**Enjoy exploring public APIs! 🎉**
