import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import MarketplaceLanding from './MarketplaceLanding';
import MarketplaceCategoryResults from './MarketplaceCategoryResults';
import MarketplaceListingDetail from './MarketplaceListingDetail';
import MarketplaceThreadDetail from './MarketplaceThreadDetail';
import MarketplaceModerationQueue from './MarketplaceModerationQueue';

const MarketplaceRoutes = ({ basePath = '/marketplace' } = {}) => {
    // basePath is informational for links; routing is handled by parent Route.
    return (
        <Routes>
            <Route index element={<MarketplaceLanding basePath={basePath} />} />
            <Route path="categories/:categoryId" element={<MarketplaceCategoryResults basePath={basePath} mode="category" />} />
            <Route path="tags/:tagId" element={<MarketplaceCategoryResults basePath={basePath} mode="tag" />} />
            <Route path="listing/:listingId" element={<MarketplaceListingDetail basePath={basePath} />} />
            <Route path="listing/:listingId/forums/thread/:threadId" element={<MarketplaceThreadDetail basePath={basePath} />} />
            <Route path="moderate" element={<MarketplaceModerationQueue basePath={basePath} />} />
            <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
    );
};

export default MarketplaceRoutes;
