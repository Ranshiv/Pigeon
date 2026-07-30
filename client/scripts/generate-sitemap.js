const fs = require('fs');
const path = require('path');

const siteUrl = (process.env.REACT_APP_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const outputDirectory = process.argv[2] || path.join(__dirname, '..', 'public');
const publicRoutes = ['/', '/documentation', '/privacy', '/terms'];
const lastmod = new Date().toISOString().slice(0, 10);
const urls = publicRoutes.map((route) => `  <url>\n    <loc>${siteUrl}${route}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`).join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(outputDirectory, 'robots.txt'), `# Public pages may be indexed.\nUser-agent: *\nDisallow: /workspace\nDisallow: /oauth\nDisallow: /alerts\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
