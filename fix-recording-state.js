// Quick script to fix stuck recording state
const mongoose = require('mongoose');
require('dotenv').config();

async function fixRecordingState() {
    try {
        const uri = process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/pigeon';
        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        // Fix all mock servers
        const result = await mongoose.connection.db.collection('mockservers').updateMany(
            { 'recording.isRecording': true },
            {
                $set: {
                    'recording.isRecording': false,
                    'recording.currentSessionId': null,
                    'recording.recordingStartedAt': null
                }
            }
        );

        console.log('Update result:', result);

        if (result.modifiedCount > 0) {
            console.log(`✅ Fixed ${result.modifiedCount} mock server(s) with stuck recording state!`);
        } else {
            console.log('No stuck recordings found in mockservers collection.');
        }

        // Also check MockRecording collection for stuck recordings
        const recordingResult = await mongoose.connection.db.collection('mockrecordings').updateMany(
            { status: 'recording' },
            { $set: { status: 'completed', endedAt: new Date() } }
        );

        if (recordingResult.modifiedCount > 0) {
            console.log(`✅ Fixed ${recordingResult.modifiedCount} stuck recording document(s)!`);
        }

        // Show mock servers to verify
        const servers = await mongoose.connection.db.collection('mockservers').find({}).project({ _id: 1, name: 1, 'recording.isRecording': 1 }).toArray();
        console.log('\nMock servers found:', servers.length);
        servers.forEach(s => console.log(`  - ${s._id}: ${s.name} (recording: ${s.recording?.isRecording || false})`));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

fixRecordingState();
