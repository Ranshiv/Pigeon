import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DocumentationViewer from './DocumentationViewer';

const PublicDocumentationPage = () => {
    const { collectionId } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const response = await fetch(`/api/collections/${collectionId}/documentation/public`);
                if (!response.ok) throw new Error(response.status === 404 ? 'This documentation is not public or no longer exists.' : 'Unable to load documentation.');
                const payload = await response.json();
                if (active) setData(payload);
            } catch (err) {
                if (active) setError(err.message);
            }
        };
        load();
        return () => { active = false; };
    }, [collectionId]);

    if (error) return <main className="public-documentation-message"><h1>Documentation unavailable</h1><p>{error}</p></main>;
    if (!data) return <main className="public-documentation-message"><p>Loading documentation…</p></main>;

    return <main className="public-documentation-page">
        <DocumentationViewer documentation={data.documentation} collection={data.collection} readOnly />
    </main>;
};

export default PublicDocumentationPage;
