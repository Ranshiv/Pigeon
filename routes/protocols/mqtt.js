// routes/protocols/mqtt.js
const express = require('express');
const router = express.Router();
const MqttService = require('../../services/protocols/MqttService');
const ProtocolSession = require('../../models/ProtocolSession');

/**
 * MQTT Protocol Routes
 * Provides endpoints for MQTT pub/sub messaging operations
 */

/**
 * POST /api/protocols/mqtt/connect
 * Connect to an MQTT broker
 */
router.post('/connect', async (req, res) => {
    try {
        const {
            url,
            clientId,
            username,
            password,
            cleanSession,
            keepAlive,
            will,
            options
        } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'MQTT broker URL is required'
            });
        }

        const connectionResult = await MqttService.connect(url, {
            clientId,
            username,
            password,
            cleanSession: cleanSession !== false,
            keepAlive: keepAlive || 60,
            will,
            ...options
        });

        // Extract the connectionId string from the result
        const connectionId = connectionResult.connectionId || connectionResult;

        // Create session record
        const session = new ProtocolSession({
            sessionId: String(connectionId),
            protocol: 'mqtt',
            endpoint: url,
            state: 'connected',
            userId: req.user?._id,
            workspaceId: req.body.workspaceId,
            mqtt: {
                clientId: clientId || String(connectionId),
                broker: url,
                cleanSession: cleanSession !== false,
                keepAlive: keepAlive || 60
            }
        });
        await session.save();

        res.json({
            success: true,
            connectionId: String(connectionId),
            message: 'MQTT connection established'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/mqtt/:connectionId/subscribe
 * Subscribe to one or more topics
 */
router.post('/:connectionId/subscribe', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { topic, topics, qos } = req.body;

        if (!topic && (!topics || topics.length === 0)) {
            return res.status(400).json({
                success: false,
                error: 'Topic or topics array is required'
            });
        }

        const subscribeTopics = topics || [{ topic, qos: qos || 0 }];

        for (const sub of subscribeTopics) {
            await MqttService.subscribe(connectionId, sub.topic, sub.qos || 0);
        }

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            for (const sub of subscribeTopics) {
                const existing = session.mqtt.subscriptions.find(s => s.topic === sub.topic);
                if (!existing) {
                    session.mqtt.subscriptions.push({
                        topic: sub.topic,
                        qos: sub.qos || 0,
                        subscribedAt: new Date()
                    });
                }
            }
            await session.save();
        }

        res.json({
            success: true,
            topics: subscribeTopics,
            message: 'Subscribed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/mqtt/:connectionId/unsubscribe
 * Unsubscribe from one or more topics
 */
router.post('/:connectionId/unsubscribe', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { topic, topics } = req.body;

        if (!topic && (!topics || topics.length === 0)) {
            return res.status(400).json({
                success: false,
                error: 'Topic or topics array is required'
            });
        }

        const unsubscribeTopics = topics || [topic];

        for (const t of unsubscribeTopics) {
            await MqttService.unsubscribe(connectionId, t);
        }

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            session.mqtt.subscriptions = session.mqtt.subscriptions.filter(
                s => !unsubscribeTopics.includes(s.topic)
            );
            await session.save();
        }

        res.json({
            success: true,
            topics: unsubscribeTopics,
            message: 'Unsubscribed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/mqtt/:connectionId/publish
 * Publish a message to a topic
 */
router.post('/:connectionId/publish', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { topic, message, qos, retain } = req.body;

        if (!topic) {
            return res.status(400).json({
                success: false,
                error: 'Topic is required'
            });
        }

        await MqttService.publish(connectionId, topic, message || '', {
            qos: qos || 0,
            retain: retain || false
        });

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            session.addMessage({
                direction: 'outgoing',
                type: 'mqtt-publish',
                content: { topic, message, qos, retain }
            });
            await session.save();
        }

        res.json({
            success: true,
            topic,
            message: 'Message published successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/mqtt/:connectionId/subscriptions
 * Get active subscriptions for a connection
 */
router.get('/:connectionId/subscriptions', async (req, res) => {
    try {
        const { connectionId } = req.params;

        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Connection not found'
            });
        }

        res.json({
            success: true,
            subscriptions: session.mqtt.subscriptions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/mqtt/:connectionId/messages
 * Get message history for a connection
 */
router.get('/:connectionId/messages', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { topic, limit = 50, direction } = req.query;

        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Connection not found'
            });
        }

        let messages = session.messages;

        if (topic) {
            messages = messages.filter(m =>
                m.content?.topic === topic ||
                (m.content?.topic && m.content.topic.match(topicToRegex(topic)))
            );
        }

        if (direction && direction !== 'all') {
            messages = messages.filter(m => m.direction === direction);
        }

        messages = messages.slice(-parseInt(limit));

        res.json({
            success: true,
            messages,
            total: messages.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/protocols/mqtt/:connectionId
 * Disconnect from MQTT broker
 */
router.delete('/:connectionId', async (req, res) => {
    try {
        const { connectionId } = req.params;

        await MqttService.disconnect(connectionId);

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            session.updateState('closed');
            await session.save();
        }

        res.json({
            success: true,
            message: 'MQTT connection closed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/mqtt/:connectionId/status
 * Get MQTT connection status
 */
router.get('/:connectionId/status', async (req, res) => {
    try {
        const { connectionId } = req.params;

        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Connection not found'
            });
        }

        const metrics = MqttService.getMetrics(connectionId);

        res.json({
            success: true,
            connectionId,
            state: session.state,
            stats: session.stats,
            metrics,
            mqtt: session.mqtt
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/mqtt/connections
 * List all active MQTT connections
 */
router.get('/connections', async (req, res) => {
    try {
        const sessions = await ProtocolSession.find({
            protocol: 'mqtt',
            userId: req.user?._id,
            state: { $in: ['connected', 'connecting', 'reconnecting'] }
        }).sort({ 'stats.lastActiveAt': -1 });

        res.json({
            success: true,
            connections: sessions,
            total: sessions.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/mqtt/:connectionId/test-topic
 * Test if a topic pattern matches another topic
 */
router.post('/:connectionId/test-topic', (req, res) => {
    try {
        const { pattern, topic } = req.body;

        if (!pattern || !topic) {
            return res.status(400).json({
                success: false,
                error: 'Pattern and topic are required'
            });
        }

        const matches = mqttTopicMatch(pattern, topic);

        res.json({
            success: true,
            pattern,
            topic,
            matches
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/mqtt/qos-levels
 * Get information about MQTT QoS levels
 */
router.get('/qos-levels', (req, res) => {
    res.json({
        success: true,
        levels: [
            {
                level: 0,
                name: 'At most once',
                description: 'Message is delivered at most once. No acknowledgment. Fire and forget.',
                useCase: 'Non-critical data where occasional loss is acceptable'
            },
            {
                level: 1,
                name: 'At least once',
                description: 'Message is delivered at least once. May result in duplicates.',
                useCase: 'Important messages where duplicates can be handled'
            },
            {
                level: 2,
                name: 'Exactly once',
                description: 'Message is delivered exactly once using 4-way handshake.',
                useCase: 'Critical messages where duplicates are not acceptable'
            }
        ]
    });
});

// Helper function to convert MQTT topic pattern to regex
function topicToRegex(pattern) {
    const escaped = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\+/g, '[^/]+')
        .replace(/#/g, '.*');
    return new RegExp(`^${escaped}$`);
}

// Helper function to test MQTT topic matching
function mqttTopicMatch(pattern, topic) {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < patternParts.length; i++) {
        const patternPart = patternParts[i];
        const topicPart = topicParts[i];

        if (patternPart === '#') {
            return true; // # matches everything from here
        }

        if (patternPart === '+') {
            if (topicPart === undefined) return false;
            continue; // + matches exactly one level
        }

        if (patternPart !== topicPart) {
            return false;
        }
    }

    return patternParts.length === topicParts.length;
}

module.exports = router;
