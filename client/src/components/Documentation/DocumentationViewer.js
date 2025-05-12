import React, { useState, useEffect } from 'react';
import SwaggerUI from 'swagger-ui-react';
import "swagger-ui-react/swagger-ui.css";
import axios from 'axios';
import {
    Box,
    CircularProgress,
    Typography,
    Alert,
    Paper,
    Tabs,
    Tab,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    InputAdornment,
    Grid,
    Tooltip,
    Card,
    CardContent,
    Snackbar,
    IconButton
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import RestoreIcon from '@mui/icons-material/Restore';
import CloseIcon from '@mui/icons-material/Close';

/**
 * DocumentationViewer component displays auto-generated API documentation
 * using Swagger UI with OpenAPI specification fetched from the server.
 */
const DocumentationViewer = () => {
    const [spec, setSpec] = useState(null);
    const [originalSpec, setOriginalSpec] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState(0);
    const [rawSpec, setRawSpec] = useState('');
    const [collections, setCollections] = useState([]);
    const [selectedCollection, setSelectedCollection] = useState('all');
    const [darkMode, setDarkMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const [availableTags, setAvailableTags] = useState([]);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [endpointSummaries, setEndpointSummaries] = useState([]);

    useEffect(() => {
        const fetchDocumentation = async () => {
            try {
                setLoading(true);

                // Fetch available collections
                const collectionsResponse = await axios.get('http://localhost:5001/api/collections', {
                    withCredentials: true
                });
                setCollections(collectionsResponse.data);

                // Fetch documentation
                const response = await axios.get('http://localhost:5001/api/documentation', {
                    withCredentials: true
                });

                const docData = response.data;
                setSpec(docData);
                setOriginalSpec(JSON.parse(JSON.stringify(docData))); // Deep copy
                setRawSpec(JSON.stringify(docData, null, 2));

                // Extract available tags
                const tags = docData.tags ? [...docData.tags.map(tag => tag.name)] : [];
                setAvailableTags(tags);

                // Create endpoint summaries
                createEndpointSummaries(docData);

                setError(null);
            } catch (err) {
                console.error('Error fetching API documentation:', err);
                setError('Failed to load API documentation. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchDocumentation();
    }, []);

    // Create simplified endpoint summaries for quick reference
    const createEndpointSummaries = (docData) => {
        if (!docData || !docData.paths) return [];

        const summaries = [];
        Object.keys(docData.paths).forEach(path => {
            Object.keys(docData.paths[path]).forEach(method => {
                const endpoint = docData.paths[path][method];
                summaries.push({
                    path,
                    method: method.toUpperCase(),
                    summary: endpoint.summary || 'No summary',
                    description: endpoint.description || 'No description',
                    tags: endpoint.tags || []
                });
            });
        });

        setEndpointSummaries(summaries);
    };

    useEffect(() => {
        if (!originalSpec) return;

        // Apply filters to the specification
        const filterSpec = () => {
            const filteredSpec = JSON.parse(JSON.stringify(originalSpec)); // Deep clone

            // If no filters, return original
            if (searchTerm === '' && selectedTags.length === 0) {
                setSpec(filteredSpec);
                setRawSpec(JSON.stringify(filteredSpec, null, 2));
                return;
            }

            // Filter paths based on search term and tags
            const filteredPaths = {};
            Object.keys(originalSpec.paths).forEach(path => {
                let includePath = false;

                Object.keys(originalSpec.paths[path]).forEach(method => {
                    const endpoint = originalSpec.paths[path][method];
                    const endpointTags = endpoint.tags || [];

                    // Check if matches search term
                    const matchesSearch = searchTerm === '' ||
                        path.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (endpoint.summary && endpoint.summary.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        (endpoint.description && endpoint.description.toLowerCase().includes(searchTerm.toLowerCase()));

                    // Check if matches selected tags
                    const matchesTags = selectedTags.length === 0 ||
                        selectedTags.some(tag => endpointTags.includes(tag));

                    // Include this method if it matches filters
                    if (matchesSearch && matchesTags) {
                        if (!filteredPaths[path]) {
                            filteredPaths[path] = {};
                        }
                        filteredPaths[path][method] = endpoint;
                        includePath = true;
                    }
                });

                // If any method matches, include the path
                if (includePath) {
                    filteredSpec.paths[path] = filteredPaths[path];
                } else {
                    delete filteredSpec.paths[path];
                }
            });

            setSpec(filteredSpec);
            setRawSpec(JSON.stringify(filteredSpec, null, 2));
        };

        filterSpec();
    }, [searchTerm, selectedTags, originalSpec]);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handleCopyRaw = () => {
        navigator.clipboard.writeText(rawSpec);
        showNotification('Specification copied to clipboard');
    };

    const handleDownloadSpec = () => {
        const blob = new Blob([rawSpec], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'api-documentation.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('Documentation downloaded as JSON');
    };

    const handleCollectionChange = async (event) => {
        const collectionId = event.target.value;
        setSelectedCollection(collectionId);
        setLoading(true);

        try {
            let url = 'http://localhost:5001/api/documentation';
            if (collectionId !== 'all') {
                url = `http://localhost:5001/api/collections/${collectionId}/documentation`;
            }

            const response = await axios.get(url, {
                withCredentials: true
            });

            const docData = response.data;
            setSpec(docData);
            setOriginalSpec(JSON.parse(JSON.stringify(docData)));
            setRawSpec(JSON.stringify(docData, null, 2));

            // Extract available tags
            const tags = docData.tags ? [...docData.tags.map(tag => tag.name)] : [];
            setAvailableTags(tags);

            // Create endpoint summaries
            createEndpointSummaries(docData);
        } catch (err) {
            console.error('Error fetching collection documentation:', err);
            setError('Failed to load documentation for the selected collection.');
        } finally {
            setLoading(false);
        }
    };

    const toggleDarkMode = () => {
        setDarkMode(!darkMode);
    };

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
    };

    const handleTagSelect = (tag) => {
        if (!selectedTags.includes(tag)) {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    const handleTagDelete = (tagToDelete) => {
        setSelectedTags(selectedTags.filter(tag => tag !== tagToDelete));
    };

    const resetFilters = () => {
        setSearchTerm('');
        setSelectedTags([]);
        showNotification('Filters reset');
    };

    const showNotification = (message) => {
        setNotificationMessage(message);
        setNotificationOpen(true);
    };

    const handleCloseNotification = () => {
        setNotificationOpen(false);
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error">
                {error}
            </Alert>
        );
    }

    return (
        <Paper elevation={2}>
            <Box p={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Typography variant="h5" component="h2">
                        API Documentation
                    </Typography>
                    <Box>
                        <Tooltip title={darkMode ? "Light Mode" : "Dark Mode"}>
                            <IconButton onClick={toggleDarkMode} sx={{ mr: 1 }}>
                                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
                            </IconButton>
                        </Tooltip>
                        <Button
                            startIcon={<ContentCopyIcon />}
                            onClick={handleCopyRaw}
                            sx={{ mr: 1 }}
                        >
                            Copy
                        </Button>
                        <Button
                            startIcon={<DownloadIcon />}
                            variant="contained"
                            onClick={handleDownloadSpec}
                        >
                            Download
                        </Button>
                    </Box>
                </Box>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                    {/* Collection selector */}
                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel>API Collection</InputLabel>
                            <Select
                                value={selectedCollection}
                                label="API Collection"
                                onChange={handleCollectionChange}
                            >
                                <MenuItem value="all">All Collections</MenuItem>
                                {collections.map((collection) => (
                                    <MenuItem key={collection._id} value={collection._id}>
                                        {collection.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Search filter */}
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Search Endpoints"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                                endAdornment: searchTerm && (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={() => setSearchTerm('')}
                                            edge="end"
                                        >
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Grid>

                    {/* Reset filters */}
                    <Grid item xs={12} md={4} display="flex" justifyContent="flex-end">
                        <Tooltip title="Reset all filters">
                            <Button
                                startIcon={<RestoreIcon />}
                                onClick={resetFilters}
                                disabled={!searchTerm && selectedTags.length === 0}
                            >
                                Reset Filters
                            </Button>
                        </Tooltip>
                    </Grid>
                </Grid>

                {/* Tags filter */}
                {availableTags.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center">
                            <FilterListIcon fontSize="small" sx={{ mr: 1 }} />
                            Filter by tags:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {availableTags.map(tag => (
                                <Chip
                                    key={tag}
                                    label={tag}
                                    onClick={() => handleTagSelect(tag)}
                                    color={selectedTags.includes(tag) ? "primary" : "default"}
                                    variant={selectedTags.includes(tag) ? "filled" : "outlined"}
                                    onDelete={selectedTags.includes(tag) ? () => handleTagDelete(tag) : undefined}
                                />
                            ))}
                        </Box>
                    </Box>
                )}

                {/* "Try it out" help card */}
                <Card variant="outlined" sx={{ mb: 3, bgcolor: 'info.50' }}>
                    <CardContent>
                        <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <HelpOutlineIcon sx={{ mr: 1 }} color="info" />
                            How to use interactive documentation
                        </Typography>
                        <Typography variant="body2">
                            1. Click on an endpoint to expand it
                        </Typography>
                        <Typography variant="body2">
                            2. Click the "Try it out" button to enable interactive testing
                        </Typography>
                        <Typography variant="body2">
                            3. Fill in any required parameters
                        </Typography>
                        <Typography variant="body2">
                            4. Click "Execute" to send the request and see the response
                        </Typography>
                    </CardContent>
                </Card>

                <Tabs value={activeTab} onChange={handleTabChange} aria-label="documentation tabs">
                    <Tab label="Interactive Documentation" />
                    <Tab label="Endpoint Summary" />
                    <Tab label="Raw Specification" />
                </Tabs>

                <Box mt={2}>
                    {activeTab === 0 ? (
                        spec && <SwaggerUI
                            spec={spec}
                            docExpansion="list"
                            deepLinking={true}
                            showExtensions={true}
                            tryItOutEnabled={true}
                            displayRequestDuration={true}
                            filter={true}
                            syntaxHighlight={{ activate: true, theme: darkMode ? 'monokai' : 'agate' }}
                        />
                    ) : activeTab === 1 ? (
                        <Box sx={{ mt: 2 }}>
                            {endpointSummaries.length > 0 ? (
                                <Grid container spacing={2}>
                                    {endpointSummaries.map((endpoint, index) => (
                                        <Grid item xs={12} key={index}>
                                            <Card variant="outlined">
                                                <CardContent>
                                                    <Box display="flex" justifyContent="space-between" alignItems="center">
                                                        <Typography variant="h6" component="h3">
                                                            {endpoint.summary}
                                                        </Typography>
                                                        <Chip
                                                            label={endpoint.method}
                                                            color={
                                                                endpoint.method === 'GET' ? 'success' :
                                                                    endpoint.method === 'POST' ? 'info' :
                                                                        endpoint.method === 'PUT' ? 'warning' :
                                                                            endpoint.method === 'DELETE' ? 'error' : 'default'
                                                            }
                                                            size="small"
                                                        />
                                                    </Box>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                                        {endpoint.path}
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {endpoint.description}
                                                    </Typography>
                                                    {endpoint.tags.length > 0 && (
                                                        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                            {endpoint.tags.map(tag => (
                                                                <Chip
                                                                    key={tag}
                                                                    label={tag}
                                                                    size="small"
                                                                    variant="outlined"
                                                                    onClick={() => handleTagSelect(tag)}
                                                                />
                                                            ))}
                                                        </Box>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>
                            ) : (
                                <Alert severity="info">
                                    No endpoints found. Try adjusting your filters or add more API requests.
                                </Alert>
                            )}
                        </Box>
                    ) : (
                        <Box
                            component="pre"
                            sx={{
                                backgroundColor: darkMode ? '#272822' : 'background.paper',
                                color: darkMode ? '#f8f8f2' : 'text.primary',
                                p: 2,
                                borderRadius: 1,
                                overflow: 'auto',
                                maxHeight: '500px',
                                fontSize: '0.875rem',
                                border: '1px solid',
                                borderColor: 'divider'
                            }}
                        >
                            {rawSpec}
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Notification */}
            <Snackbar
                open={notificationOpen}
                autoHideDuration={4000}
                onClose={handleCloseNotification}
                message={notificationMessage}
                action={
                    <IconButton
                        size="small"
                        color="inherit"
                        onClick={handleCloseNotification}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                }
            />
        </Paper>
    );
};

export default DocumentationViewer;