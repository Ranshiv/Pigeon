import React from 'react';
import { Container, Typography, Box, Breadcrumbs, Link } from '@mui/material';
import DocumentationViewer from './DocumentationViewer';
import HomeIcon from '@mui/icons-material/Home';
import DescriptionIcon from '@mui/icons-material/Description';

/**
 * DocumentationPage component serves as a container for the DocumentationViewer
 * and provides navigation context with breadcrumbs.
 */
const DocumentationPage = () => {
    return (
        <Container maxWidth="xl">
            <Box my={4}>
                <Breadcrumbs aria-label="breadcrumb" mb={2}>
                    <Link
                        color="inherit"
                        href="/workspace/home"
                        sx={{ display: 'flex', alignItems: 'center' }}
                    >
                        <HomeIcon sx={{ mr: 0.5, fontSize: '1.2rem' }} />
                        Home
                    </Link>
                    <Typography
                        color="text.primary"
                        sx={{ display: 'flex', alignItems: 'center' }}
                    >
                        <DescriptionIcon sx={{ mr: 0.5, fontSize: '1.2rem' }} />
                        Documentation
                    </Typography>
                </Breadcrumbs>

                <Typography variant="h4" component="h1" gutterBottom>
                    API Documentation
                </Typography>

                <Typography variant="body1" color="text.secondary" paragraph>
                    This documentation is automatically generated from your API requests. Use the interactive
                    documentation below to explore your API endpoints, parameters, and response formats.
                </Typography>

                <Box mt={4}>
                    <DocumentationViewer />
                </Box>
            </Box>
        </Container>
    );
};

export default DocumentationPage;