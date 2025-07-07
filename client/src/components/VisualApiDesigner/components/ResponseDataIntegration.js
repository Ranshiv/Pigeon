import { useState } from 'react';
import { VisualizationEngine } from '../services/VisualizationEngine';

/**
 * ResponseDataIntegration component
 * Connects API responses with visualization system
 */
const ResponseDataIntegration = ({
    endpoint,
    onResponseVisualized,
    onError
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [responseData, setResponseData] = useState(null);
    const [visualizations, setVisualizations] = useState([]);

    const executeApiCall = async () => {
        if (!endpoint) return;

        setIsLoading(true);
        try {
            // Mock API call for demonstration
            // In production, this would make an actual HTTP request
            const mockResponse = await simulateApiCall(endpoint);

            setResponseData(mockResponse);

            // Auto-generate visualizations from response
            const autoVisualizations = VisualizationEngine.generateFromResponse(
                mockResponse.data,
                {
                    title: `${endpoint.method} ${endpoint.path} Response`,
                    includeMetadata: true
                }
            );

            // Add response metadata visualization
            const metadataViz = VisualizationEngine.createMetrics({
                'Status Code': mockResponse.status,
                'Response Time': `${mockResponse.responseTime}ms`,
                'Response Size': mockResponse.size,
                'Content Type': mockResponse.headers['content-type'] || 'application/json'
            }, {
                title: 'Response Metadata'
            });

            const allVisualizations = [metadataViz, ...autoVisualizations];
            setVisualizations(allVisualizations);

            if (onResponseVisualized) {
                onResponseVisualized(allVisualizations, mockResponse);
            }

        } catch (error) {
            console.error('API call failed:', error);
            if (onError) {
                onError(error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const simulateApiCall = async (endpoint) => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        // Generate mock response based on endpoint
        const responseTypes = {
            '/users': () => ({
                users: Array.from({ length: 10 }, (_, i) => ({
                    id: i + 1,
                    name: `User ${i + 1}`,
                    email: `user${i + 1}@example.com`,
                    age: 20 + Math.floor(Math.random() * 40),
                    score: 60 + Math.floor(Math.random() * 40),
                    status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)],
                    joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
                })),
                total: 10,
                page: 1
            }),
            '/analytics': () => ({
                overview: {
                    totalUsers: 15420,
                    activeUsers: 8750,
                    newUsers: 342,
                    returningUsers: 8408,
                    conversionRate: 3.8,
                    revenue: 125430
                },
                dailyStats: Array.from({ length: 7 }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (6 - i));
                    return {
                        date: date.toISOString().split('T')[0],
                        visitors: 1000 + Math.floor(Math.random() * 2000),
                        pageViews: 5000 + Math.floor(Math.random() * 10000),
                        bounceRate: 20 + Math.random() * 40,
                        avgSessionDuration: 120 + Math.random() * 300
                    };
                }),
                topPages: [
                    { path: '/home', views: 15420 },
                    { path: '/products', views: 8750 },
                    { path: '/about', views: 3210 },
                    { path: '/contact', views: 1890 }
                ]
            }),
            '/orders': () => ({
                orders: Array.from({ length: 15 }, (_, i) => ({
                    id: `ORD-${1000 + i}`,
                    customerName: `Customer ${i + 1}`,
                    amount: 50 + Math.random() * 500,
                    status: ['pending', 'processing', 'shipped', 'delivered'][Math.floor(Math.random() * 4)],
                    items: Math.floor(Math.random() * 5) + 1,
                    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
                })),
                totalRevenue: 15420.50,
                totalOrders: 15,
                averageOrderValue: 102.80
            }),
            '/health': () => ({
                status: 'healthy',
                services: [
                    { name: 'database', status: 'healthy', responseTime: 12 },
                    { name: 'cache', status: 'healthy', responseTime: 3 },
                    { name: 'search', status: 'degraded', responseTime: 156 },
                    { name: 'payment', status: 'healthy', responseTime: 89 }
                ],
                metrics: {
                    uptime: 99.9,
                    responseTime: 245,
                    errorRate: 0.1,
                    throughput: 1540
                }
            })
        };

        // Determine response based on endpoint path
        let responseGenerator = responseTypes['/users']; // default

        Object.keys(responseTypes).forEach(path => {
            if (endpoint.path.includes(path.slice(1))) {
                responseGenerator = responseTypes[path];
            }
        });

        const data = responseGenerator();

        return {
            status: 200,
            statusText: 'OK',
            headers: {
                'content-type': 'application/json',
                'content-length': JSON.stringify(data).length.toString()
            },
            data: data,
            responseTime: 200 + Math.random() * 300,
            size: JSON.stringify(data).length,
            timestamp: new Date().toISOString()
        };
    };

    return {
        isLoading,
        responseData,
        visualizations,
        executeApiCall
    };
};

export default ResponseDataIntegration;
