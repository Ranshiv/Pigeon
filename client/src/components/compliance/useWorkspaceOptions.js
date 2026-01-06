// client/src/components/compliance/useWorkspaceOptions.js
import { useEffect, useMemo, useState } from 'react';

function normalizeWorkspacesResponse(payload) {
    const personal = Array.isArray(payload?.personal) ? payload.personal : [];
    const team = Array.isArray(payload?.team) ? payload.team : [];
    const merged = [...personal, ...team];

    return merged
        .filter(Boolean)
        .map((w) => {
            const id = w._id || w.id;
            const name = w.name || 'Untitled workspace';
            const isPersonal = Boolean(w.isPersonal);

            return {
                id: String(id),
                name,
                isPersonal,
                label: `${name}${isPersonal ? ' (Personal)' : ''}`
            };
        })
        .filter((w) => w.id && w.id !== 'undefined');
}

export function useWorkspaceOptions() {
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const fetchWorkspaces = async () => {
            try {
                setLoading(true);
                setError(null);

                const res = await fetch('/api/workspaces', { credentials: 'include' });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || `Failed to fetch workspaces (${res.status})`);
                }

                const payload = await res.json();
                const options = normalizeWorkspacesResponse(payload);

                if (!cancelled) setWorkspaces(options);
            } catch (e) {
                if (!cancelled) setError(e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchWorkspaces();

        return () => {
            cancelled = true;
        };
    }, []);

    const defaultWorkspaceId = useMemo(() => {
        if (!workspaces.length) return '';
        const personal = workspaces.find((w) => w.isPersonal);
        return (personal || workspaces[0]).id;
    }, [workspaces]);

    return { workspaces, defaultWorkspaceId, loading, error };
}
