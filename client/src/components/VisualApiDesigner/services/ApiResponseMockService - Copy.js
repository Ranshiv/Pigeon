/**
 * API Response Mock Service
 * Provides mock API responses for testing visualization features
 */
export class ApiResponseMockService {
    static responses = new Map();

    /**
     * Generate mock API response based on endpoint configuration
     * @param {Object} endpoint - Endpoint configuration
     * @returns {Object} Mock response
     */
    static generateMockResponse(endpoint) {
        const { path, summary } = endpoint;
        const responseTypes = this.getResponseTypeFromPath(path);

        return {
            status: this.getRandomStatus(),
            statusText: this.getStatusText(200),
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': '1024',
                'X-Response-Time': '245ms'
            },
            data: this.generateMockData(responseTypes, summary),
            responseTime: this.getRandomResponseTime(),
            size: this.getRandomSize(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get response type based on endpoint path
     * @param {string} path - API endpoint path
     * @returns {string} Response type
     */
    static getResponseTypeFromPath(path) {
        if (path.includes('users') || path.includes('user')) return 'users';
        if (path.includes('orders') || path.includes('order')) return 'orders';
        if (path.includes('products') || path.includes('product')) return 'products';
        if (path.includes('analytics') || path.includes('metrics')) return 'analytics';
        if (path.includes('status') || path.includes('health')) return 'status';
        return 'generic';
    }

    /**
     * Generate mock data based on type
     * @param {string} type - Data type
     * @param {string} summary - Endpoint summary
     * @returns {Object} Mock data
     */
    static generateMockData(type, summary = '') {
        const isListEndpoint = summary.toLowerCase().includes('list') ||
            summary.toLowerCase().includes('all') ||
            summary.toLowerCase().includes('get all');

        switch (type) {
            case 'users':
                return isListEndpoint ? this.generateUsersList() : this.generateUser();
            case 'orders':
                return isListEndpoint ? this.generateOrdersList() : this.generateOrder();
            case 'products':
                return isListEndpoint ? this.generateProductsList() : this.generateProduct();
            case 'analytics':
                return this.generateAnalytics();
            case 'status':
                return this.generateStatus();
            default:
                return this.generateGenericData();
        }
    }

    /**
     * Generate users list data
     * @returns {Object} Users list response
     */
    static generateUsersList() {
        const users = Array.from({ length: this.getRandomInt(5, 15) }, (_, i) => ({
            id: i + 1,
            name: this.getRandomName(),
            email: this.getRandomEmail(),
            age: this.getRandomInt(18, 65),
            status: this.getRandomChoice(['active', 'inactive', 'pending']),
            role: this.getRandomChoice(['user', 'admin', 'moderator']),
            createdAt: this.getRandomDate(),
            lastLogin: this.getRandomDate()
        }));

        return {
            users: users,
            total: users.length,
            page: 1,
            pageSize: users.length,
            hasNext: false
        };
    }

    /**
     * Generate single user data
     * @returns {Object} User response
     */
    static generateUser() {
        return {
            id: 1,
            name: this.getRandomName(),
            email: this.getRandomEmail(),
            age: this.getRandomInt(18, 65),
            status: 'active',
            role: 'user',
            profile: {
                bio: 'Software developer with passion for API design',
                location: 'San Francisco, CA',
                website: 'https://example.com'
            },
            preferences: {
                notifications: true,
                theme: 'dark',
                language: 'en'
            },
            createdAt: this.getRandomDate(),
            lastLogin: this.getRandomDate()
        };
    }

    /**
     * Generate orders list data
     * @returns {Object} Orders list response
     */
    static generateOrdersList() {
        const orders = Array.from({ length: this.getRandomInt(3, 10) }, (_, i) => ({
            id: `ORDER-${1000 + i}`,
            customerName: this.getRandomName(),
            amount: this.getRandomFloat(10, 500),
            status: this.getRandomChoice(['pending', 'processing', 'shipped', 'delivered']),
            items: this.getRandomInt(1, 5),
            createdAt: this.getRandomDate(),
            estimatedDelivery: this.getRandomFutureDate()
        }));

        return {
            orders: orders,
            totalRevenue: orders.reduce((sum, order) => sum + order.amount, 0),
            totalOrders: orders.length,
            averageOrderValue: orders.reduce((sum, order) => sum + order.amount, 0) / orders.length
        };
    }

    /**
     * Generate single order data
     * @returns {Object} Order response
     */
    static generateOrder() {
        return {
            id: 'ORDER-1001',
            customer: {
                name: this.getRandomName(),
                email: this.getRandomEmail(),
                phone: this.getRandomPhone()
            },
            items: [
                {
                    id: 'PROD-1',
                    name: 'Wireless Headphones',
                    quantity: 1,
                    price: 99.99
                },
                {
                    id: 'PROD-2',
                    name: 'Phone Case',
                    quantity: 2,
                    price: 24.99
                }
            ],
            subtotal: 149.97,
            tax: 12.00,
            shipping: 9.99,
            total: 171.96,
            status: 'processing',
            createdAt: this.getRandomDate(),
            estimatedDelivery: this.getRandomFutureDate(),
            shippingAddress: {
                street: '123 Main St',
                city: 'San Francisco',
                state: 'CA',
                zipCode: '94105',
                country: 'USA'
            }
        };
    }

    /**
     * Generate products list data
     * @returns {Object} Products list response
     */
    static generateProductsList() {
        const products = Array.from({ length: this.getRandomInt(5, 12) }, (_, i) => ({
            id: `PROD-${100 + i}`,
            name: this.getRandomProductName(),
            price: this.getRandomFloat(5, 299),
            category: this.getRandomChoice(['Electronics', 'Clothing', 'Books', 'Home', 'Sports']),
            stock: this.getRandomInt(0, 100),
            rating: this.getRandomFloat(3, 5),
            reviews: this.getRandomInt(0, 500),
            featured: this.getRandomBoolean()
        }));

        return {
            products: products,
            categories: ['Electronics', 'Clothing', 'Books', 'Home', 'Sports'],
            totalProducts: products.length,
            inStock: products.filter(p => p.stock > 0).length,
            averagePrice: products.reduce((sum, p) => sum + p.price, 0) / products.length
        };
    }

    /**
     * Generate analytics data
     * @returns {Object} Analytics response
     */
    static generateAnalytics() {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return {
                date: date.toISOString().split('T')[0],
                visitors: this.getRandomInt(100, 1000),
                pageViews: this.getRandomInt(500, 5000),
                bounceRate: this.getRandomFloat(20, 60),
                avgSessionDuration: this.getRandomInt(120, 600)
            };
        });

        return {
            overview: {
                totalUsers: this.getRandomInt(10000, 50000),
                activeUsers: this.getRandomInt(1000, 5000),
                newUsers: this.getRandomInt(100, 500),
                returningUsers: this.getRandomInt(900, 4500),
                conversionRate: this.getRandomFloat(2, 8),
                revenue: this.getRandomFloat(10000, 100000)
            },
            dailyStats: last7Days,
            topPages: [
                { path: '/home', views: this.getRandomInt(1000, 5000) },
                { path: '/products', views: this.getRandomInt(500, 3000) },
                { path: '/about', views: this.getRandomInt(200, 1000) },
                { path: '/contact', views: this.getRandomInt(100, 800) }
            ],
            deviceTypes: {
                desktop: this.getRandomFloat(40, 60),
                mobile: this.getRandomFloat(30, 50),
                tablet: this.getRandomFloat(5, 15)
            },
            trafficSources: {
                organic: this.getRandomFloat(40, 60),
                direct: this.getRandomFloat(20, 40),
                social: this.getRandomFloat(10, 20),
                referral: this.getRandomFloat(5, 15),
                email: this.getRandomFloat(2, 10)
            }
        };
    }

    /**
     * Generate status/health data
     * @returns {Object} Status response
     */
    static generateStatus() {
        const services = ['database', 'cache', 'search', 'payment', 'email'];
        const serviceStatus = services.map(service => ({
            name: service,
            status: this.getRandomChoice(['healthy', 'degraded', 'down']),
            responseTime: this.getRandomInt(1, 100),
            lastChecked: new Date().toISOString(),
            uptime: this.getRandomFloat(95, 100)
        }));

        return {
            overall: 'healthy',
            services: serviceStatus,
            metrics: {
                uptime: this.getRandomFloat(99, 100),
                responseTime: this.getRandomInt(50, 200),
                errorRate: this.getRandomFloat(0, 2),
                throughput: this.getRandomInt(100, 1000)
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Generate generic data
     * @returns {Object} Generic response
     */
    static generateGenericData() {
        return {
            id: this.getRandomInt(1, 1000),
            message: 'API response data',
            success: true,
            data: {
                items: Array.from({ length: this.getRandomInt(3, 8) }, (_, i) => ({
                    id: i + 1,
                    name: `Item ${i + 1}`,
                    value: this.getRandomFloat(1, 100),
                    active: this.getRandomBoolean()
                }))
            },
            metadata: {
                total: this.getRandomInt(50, 500),
                page: 1,
                limit: 10
            }
        };
    }

    // Utility methods for generating random data
    static getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static getRandomFloat(min, max, decimals = 2) {
        return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
    }

    static getRandomBoolean() {
        return Math.random() > 0.5;
    }

    static getRandomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    static getRandomName() {
        const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Chris', 'Anna'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
        return `${this.getRandomChoice(firstNames)} ${this.getRandomChoice(lastNames)}`;
    }

    static getRandomEmail() {
        const domains = ['example.com', 'test.com', 'demo.org', 'sample.net'];
        const name = this.getRandomName().toLowerCase().replace(' ', '.');
        return `${name}@${this.getRandomChoice(domains)}`;
    }

    static getRandomPhone() {
        return `+1-${this.getRandomInt(100, 999)}-${this.getRandomInt(100, 999)}-${this.getRandomInt(1000, 9999)}`;
    }

    static getRandomProductName() {
        const adjectives = ['Premium', 'Professional', 'Advanced', 'Smart', 'Ultra', 'Pro'];
        const products = ['Headphones', 'Laptop', 'Phone', 'Watch', 'Speaker', 'Camera'];
        return `${this.getRandomChoice(adjectives)} ${this.getRandomChoice(products)}`;
    }

    static getRandomDate() {
        const start = new Date(2023, 0, 1);
        const end = new Date();
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
    }

    static getRandomFutureDate() {
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 30);
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
    }

    static getRandomStatus() {
        const statuses = [200, 201, 400, 404, 500];
        const weights = [0.7, 0.1, 0.1, 0.05, 0.05]; // 70% success rate

        const random = Math.random();
        let cumulativeWeight = 0;

        for (let i = 0; i < statuses.length; i++) {
            cumulativeWeight += weights[i];
            if (random <= cumulativeWeight) {
                return statuses[i];
            }
        }

        return 200;
    }

    static getStatusText(status) {
        const statusTexts = {
            200: 'OK',
            201: 'Created',
            400: 'Bad Request',
            404: 'Not Found',
            500: 'Internal Server Error'
        };
        return statusTexts[status] || 'Unknown';
    }

    static getRandomResponseTime() {
        // Simulate realistic response times with occasional spikes
        const base = this.getRandomInt(50, 300);
        const spike = Math.random() < 0.1 ? this.getRandomInt(500, 2000) : 0;
        return base + spike;
    }

    static getRandomSize() {
        return this.getRandomInt(512, 8192); // Bytes
    }

    /**
     * Store response for a specific endpoint
     * @param {string} endpointId - Endpoint identifier
     * @param {Object} response - Response data
     */
    static storeResponse(endpointId, response) {
        this.responses.set(endpointId, {
            ...response,
            storedAt: new Date().toISOString()
        });
    }

    /**
     * Get stored response for an endpoint
     * @param {string} endpointId - Endpoint identifier
     * @returns {Object|null} Stored response or null
     */
    static getStoredResponse(endpointId) {
        return this.responses.get(endpointId) || null;
    }

    /**
     * Clear all stored responses
     */
    static clearResponses() {
        this.responses.clear();
    }

    /**
     * Get all stored responses
     * @returns {Array} Array of stored responses
     */
    static getAllResponses() {
        return Array.from(this.responses.entries()).map(([id, response]) => ({
            endpointId: id,
            ...response
        }));
    }
}

export default ApiResponseMockService;
