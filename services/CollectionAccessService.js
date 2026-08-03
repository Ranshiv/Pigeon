const { ObjectId } = require('mongodb');

const userIdOf = (user) => String(user?.id || user?._id || '');
const idVariants = (value) => {
    const text = String(value || '');
    return ObjectId.isValid(text) ? [text, new ObjectId(text)] : [text];
};

function accessClauses(user, requiredRole = 'viewer') {
    const ids = idVariants(userIdOf(user));
    const roles = requiredRole === 'admin' ? ['admin'] : requiredRole === 'editor' ? ['editor', 'admin'] : ['viewer', 'editor', 'admin'];
    return [
        { userId: { $in: ids } },
        { owner: { $in: ids } },
        { collaborators: { $elemMatch: { userId: { $in: ids }, role: { $in: roles } } } }
    ];
}

async function findCollectionForUser(db, collectionId, user, requiredRole = 'viewer') {
    if (!db || !ObjectId.isValid(collectionId) || !userIdOf(user)) return null;
    return db.collection('collections').findOne({
        _id: new ObjectId(collectionId),
        $or: accessClauses(user, requiredRole)
    });
}

function isCollectionOwnerOrAdmin(collection, user) {
    const userId = userIdOf(user);
    if (!collection || !userId) return false;
    if ([collection.userId, collection.owner].some((value) => String(value || '') === userId)) return true;
    return (collection.collaborators || []).some((item) => String(item.userId || '') === userId && item.role === 'admin');
}

module.exports = { userIdOf, idVariants, accessClauses, findCollectionForUser, isCollectionOwnerOrAdmin };
