require('dotenv').config();
const { connectMongoose } = require('../config/db');
const MarketplaceApi = require('../models/MarketplaceApi');
const mongoose = require('mongoose');

const publicApiCatalog = [
    // Popular APIs
    {
        id: 'openweathermap',
        name: 'OpenWeatherMap',
        provider: 'OpenWeather',
        description: 'Current weather data, forecasts, and historical data for any location',
        category: 'Weather',
        tags: ['weather', 'forecast', 'climate', 'geolocation'],
        authType: 'API Key',
        pricing: 'Freemium',
        ratingAverage: 4.5,
        ratingCount: 12850,
        usageCount: 458920,
        baseUrl: 'https://api.openweathermap.org/data/2.5',
        logo: 'https://openweathermap.org/themes/openweathermap/assets/img/logo_white_cropped.png',
        endpoints: [
            {
                path: '/weather',
                method: 'GET',
                description: 'Get current weather data',
                parameters: [
                    { name: 'q', type: 'query', required: true, description: 'City name' },
                    { name: 'appid', type: 'query', required: true, description: 'API key' },
                    { name: 'units', type: 'query', required: false, description: 'Units (metric, imperial)' }
                ]
            },
            {
                path: '/forecast',
                method: 'GET',
                description: 'Get 5 day forecast',
                parameters: [
                    { name: 'q', type: 'query', required: true, description: 'City name' },
                    { name: 'appid', type: 'query', required: true, description: 'API key' }
                ]
            }
        ],
        documentation: 'https://openweathermap.org/api',
        featured: true,
        trending: true
    },
    {
        id: 'jsonplaceholder',
        name: 'JSONPlaceholder',
        provider: 'Typicode',
        description: 'Free fake REST API for testing and prototyping',
        category: 'Development',
        tags: ['testing', 'mock', 'placeholder', 'json'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.8,
        ratingCount: 8420,
        usageCount: 892340,
        baseUrl: 'https://jsonplaceholder.typicode.com',
        endpoints: [
            {
                path: '/posts',
                method: 'GET',
                description: 'Get all posts'
            },
            {
                path: '/posts/{id}',
                method: 'GET',
                description: 'Get single post',
                parameters: [
                    { name: 'id', type: 'path', required: true, description: 'Post ID' }
                ]
            },
            {
                path: '/posts',
                method: 'POST',
                description: 'Create a post',
                body: {
                    title: 'string',
                    body: 'string',
                    userId: 'number'
                }
            }
        ],
        documentation: 'https://jsonplaceholder.typicode.com/',
        featured: true,
        trending: true
    },
    {
        id: 'restcountries',
        name: 'REST Countries',
        provider: 'REST Countries',
        description: 'Get information about countries via a RESTful API',
        category: 'Data',
        tags: ['countries', 'geography', 'flags', 'data'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.7,
        ratingCount: 5630,
        usageCount: 234510,
        baseUrl: 'https://restcountries.com/v3.1',
        endpoints: [
            {
                path: '/all',
                method: 'GET',
                description: 'Get all countries'
            },
            {
                path: '/name/{name}',
                method: 'GET',
                description: 'Search by country name',
                parameters: [
                    { name: 'name', type: 'path', required: true, description: 'Country name' }
                ]
            },
            {
                path: '/alpha/{code}',
                method: 'GET',
                description: 'Search by country code',
                parameters: [
                    { name: 'code', type: 'path', required: true, description: 'Country code (2 or 3 letters)' }
                ]
            }
        ],
        documentation: 'https://restcountries.com/',
        featured: true
    },
    {
        id: 'github',
        name: 'GitHub REST API',
        provider: 'GitHub',
        description: 'Access GitHub data including repos, users, and organizations',
        category: 'Development',
        tags: ['git', 'repositories', 'code', 'version-control'],
        authType: 'OAuth 2.0',
        pricing: 'Free',
        ratingAverage: 4.9,
        ratingCount: 15420,
        usageCount: 1245680,
        baseUrl: 'https://api.github.com',
        endpoints: [
            {
                path: '/users/{username}',
                method: 'GET',
                description: 'Get a user',
                parameters: [
                    { name: 'username', type: 'path', required: true, description: 'GitHub username' }
                ]
            },
            {
                path: '/users/{username}/repos',
                method: 'GET',
                description: 'List user repositories',
                parameters: [
                    { name: 'username', type: 'path', required: true, description: 'GitHub username' }
                ]
            },
            {
                path: '/repos/{owner}/{repo}',
                method: 'GET',
                description: 'Get a repository',
                parameters: [
                    { name: 'owner', type: 'path', required: true, description: 'Repository owner' },
                    { name: 'repo', type: 'path', required: true, description: 'Repository name' }
                ]
            }
        ],
        documentation: 'https://docs.github.com/rest',
        trending: true
    },
    {
        id: 'coingecko',
        name: 'CoinGecko API',
        provider: 'CoinGecko',
        description: 'Cryptocurrency data including prices, market data, and exchange info',
        category: 'Finance',
        tags: ['cryptocurrency', 'bitcoin', 'blockchain', 'market'],
        authType: 'API Key',
        pricing: 'Freemium',
        ratingAverage: 4.6,
        ratingCount: 7830,
        usageCount: 567210,
        baseUrl: 'https://api.coingecko.com/api/v3',
        endpoints: [
            {
                path: '/ping',
                method: 'GET',
                description: 'Check API server status'
            },
            {
                path: '/simple/price',
                method: 'GET',
                description: 'Get current price of cryptocurrencies',
                parameters: [
                    { name: 'ids', type: 'query', required: true, description: 'Coin IDs (comma-separated)' },
                    { name: 'vs_currencies', type: 'query', required: true, description: 'Target currencies' }
                ]
            },
            {
                path: '/coins/markets',
                method: 'GET',
                description: 'List all supported coins with market data',
                parameters: [
                    { name: 'vs_currency', type: 'query', required: true, description: 'Target currency' }
                ]
            }
        ],
        documentation: 'https://www.coingecko.com/api/documentation',
        trending: true
    },
    {
        id: 'nasa',
        name: 'NASA APIs',
        provider: 'NASA',
        description: 'Access NASA data including astronomy pictures, Mars rover photos, and more',
        category: 'Science',
        tags: ['space', 'astronomy', 'nasa', 'images'],
        authType: 'API Key',
        pricing: 'Free',
        ratingAverage: 4.8,
        ratingCount: 9240,
        usageCount: 423180,
        baseUrl: 'https://api.nasa.gov',
        endpoints: [
            {
                path: '/planetary/apod',
                method: 'GET',
                description: 'Astronomy Picture of the Day',
                parameters: [
                    { name: 'api_key', type: 'query', required: true, description: 'NASA API key' },
                    { name: 'date', type: 'query', required: false, description: 'Date (YYYY-MM-DD)' }
                ]
            },
            {
                path: '/mars-photos/api/v1/rovers/curiosity/photos',
                method: 'GET',
                description: 'Mars Rover Photos',
                parameters: [
                    { name: 'sol', type: 'query', required: true, description: 'Martian sol' },
                    { name: 'api_key', type: 'query', required: true, description: 'NASA API key' }
                ]
            }
        ],
        documentation: 'https://api.nasa.gov/',
        featured: true
    },
    {
        id: 'newsapi',
        name: 'NewsAPI',
        provider: 'NewsAPI',
        description: 'Search and retrieve live articles from news sources and blogs',
        category: 'News',
        tags: ['news', 'articles', 'headlines', 'media'],
        authType: 'API Key',
        pricing: 'Freemium',
        ratingAverage: 4.4,
        ratingCount: 6120,
        usageCount: 289450,
        baseUrl: 'https://newsapi.org/v2',
        endpoints: [
            {
                path: '/top-headlines',
                method: 'GET',
                description: 'Get top headlines',
                parameters: [
                    { name: 'country', type: 'query', required: false, description: 'Country code' },
                    { name: 'category', type: 'query', required: false, description: 'News category' },
                    { name: 'apiKey', type: 'query', required: true, description: 'API key' }
                ]
            },
            {
                path: '/everything',
                method: 'GET',
                description: 'Search all articles',
                parameters: [
                    { name: 'q', type: 'query', required: true, description: 'Search query' },
                    { name: 'apiKey', type: 'query', required: true, description: 'API key' }
                ]
            }
        ],
        documentation: 'https://newsapi.org/docs'
    },
    {
        id: 'exchangerate',
        name: 'Exchange Rate API',
        provider: 'ExchangeRate-API',
        description: 'Real-time and historical foreign exchange rates',
        category: 'Finance',
        tags: ['currency', 'forex', 'exchange', 'rates'],
        authType: 'API Key',
        pricing: 'Freemium',
        ratingAverage: 4.5,
        ratingCount: 4890,
        usageCount: 178920,
        baseUrl: 'https://v6.exchangerate-api.com/v6',
        endpoints: [
            {
                path: '/{api_key}/latest/{base}',
                method: 'GET',
                description: 'Get latest exchange rates',
                parameters: [
                    { name: 'api_key', type: 'path', required: true, description: 'API key' },
                    { name: 'base', type: 'path', required: true, description: 'Base currency code' }
                ]
            },
            {
                path: '/{api_key}/pair/{from}/{to}',
                method: 'GET',
                description: 'Get conversion rate between two currencies',
                parameters: [
                    { name: 'api_key', type: 'path', required: true, description: 'API key' },
                    { name: 'from', type: 'path', required: true, description: 'From currency code' },
                    { name: 'to', type: 'path', required: true, description: 'To currency code' }
                ]
            }
        ],
        documentation: 'https://www.exchangerate-api.com/docs'
    },
    {
        id: 'randomuser',
        name: 'Random User Generator',
        provider: 'RandomUser.me',
        description: 'Generate random user data for testing purposes',
        category: 'Development',
        tags: ['random', 'testing', 'mock', 'users'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.7,
        ratingCount: 5240,
        usageCount: 334560,
        baseUrl: 'https://randomuser.me/api',
        endpoints: [
            {
                path: '/',
                method: 'GET',
                description: 'Generate random user(s)',
                parameters: [
                    { name: 'results', type: 'query', required: false, description: 'Number of users to generate' },
                    { name: 'gender', type: 'query', required: false, description: 'Gender (male/female)' },
                    { name: 'nat', type: 'query', required: false, description: 'Nationality' }
                ]
            }
        ],
        documentation: 'https://randomuser.me/documentation',
        featured: true
    },
    {
        id: 'ipapi',
        name: 'IP-API',
        provider: 'IP-API',
        description: 'IP geolocation API for locating IP addresses',
        category: 'Data',
        tags: ['ip', 'geolocation', 'location', 'tracking'],
        authType: 'None',
        pricing: 'Freemium',
        ratingAverage: 4.3,
        ratingCount: 3670,
        usageCount: 145280,
        baseUrl: 'http://ip-api.com',
        endpoints: [
            {
                path: '/json/{ip}',
                method: 'GET',
                description: 'Get IP geolocation data',
                parameters: [
                    { name: 'ip', type: 'path', required: false, description: 'IP address (optional, uses requester IP if not provided)' }
                ]
            }
        ],
        documentation: 'https://ip-api.com/docs'
    },
    {
        id: 'unsplash',
        name: 'Unsplash API',
        provider: 'Unsplash',
        description: 'Access millions of high-quality, free-to-use images',
        category: 'Images',
        tags: ['photos', 'images', 'wallpaper', 'stock'],
        authType: 'API Key',
        pricing: 'Free',
        ratingAverage: 4.9,
        ratingCount: 12450,
        usageCount: 890200,
        baseUrl: 'https://api.unsplash.com',
        endpoints: [
            {
                path: '/photos',
                method: 'GET',
                description: 'Get a list of photos',
                parameters: [
                    { name: 'page', type: 'query', required: false, description: 'Page number' },
                    { name: 'per_page', type: 'query', required: false, description: 'Number of items per page' }
                ]
            },
            {
                path: '/search/photos',
                method: 'GET',
                description: 'Search for photos',
                parameters: [
                    { name: 'query', type: 'query', required: true, description: 'Search term' }
                ]
            }
        ],
        documentation: 'https://unsplash.com/documentation',
        featured: true
    },
    {
        id: 'dogapi',
        name: 'Dog API',
        provider: 'Dog CEO',
        description: 'Access random dog images and list of breeds',
        category: 'Animals',
        tags: ['dogs', 'pets', 'animals', 'images'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.8,
        ratingCount: 9320,
        usageCount: 456700,
        baseUrl: 'https://dog.ceo/api',
        endpoints: [
            {
                path: '/breeds/image/random',
                method: 'GET',
                description: 'Get a random dog image'
            },
            {
                path: '/breeds/list/all',
                method: 'GET',
                description: 'List all breeds'
            }
        ],
        documentation: 'https://dog.ceo/dog-api/',
        trending: true
    },
    {
        id: 'pokeapi',
        name: 'PokeAPI',
        provider: 'PokeAPI',
        description: 'Comprehensive database of Pokémon data',
        category: 'Games',
        tags: ['pokemon', 'games', 'data', 'entertainment'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.9,
        ratingCount: 15600,
        usageCount: 1240500,
        baseUrl: 'https://pokeapi.co/api/v2',
        endpoints: [
            {
                path: '/pokemon/{name}',
                method: 'GET',
                description: 'Get Pokemon details',
                parameters: [
                    { name: 'name', type: 'path', required: true, description: 'Pokemon name or ID' }
                ]
            }
        ],
        documentation: 'https://pokeapi.co/',
        featured: true
    },
    {
        id: 'boredapi',
        name: 'Bored API',
        provider: 'BoredAPI',
        description: 'Suggestions for random activities to do when bored',
        category: 'Lifestyle',
        tags: ['activities', 'boredom', 'fun', 'suggestions'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.5,
        ratingCount: 3200,
        usageCount: 125000,
        baseUrl: 'https://www.boredapi.com/api',
        endpoints: [
            {
                path: '/activity',
                method: 'GET',
                description: 'Get a random activity'
            }
        ],
        documentation: 'https://www.boredapi.com/'
    },
    {
        id: 'quizapi',
        name: 'Quiz API',
        provider: 'QuizAPI.io',
        description: 'Technical quiz questions for developers',
        category: 'Education',
        tags: ['quiz', 'learning', 'coding', 'technical'],
        authType: 'API Key',
        pricing: 'Free',
        ratingAverage: 4.6,
        ratingCount: 2100,
        usageCount: 89000,
        baseUrl: 'https://quizapi.io/api/v1',
        endpoints: [
            {
                path: '/questions',
                method: 'GET',
                description: 'Get quiz questions',
                parameters: [
                    { name: 'apiKey', type: 'query', required: true, description: 'API Key' },
                    { name: 'limit', type: 'query', required: false, description: 'Number of questions' }
                ]
            }
        ],
        documentation: 'https://quizapi.io/docs/1.0.0/overview'
    },
    {
        id: 'openlibrary',
        name: 'Open Library API',
        provider: 'Internet Archive',
        description: 'Access data about books, authors, and subjects',
        category: 'Education',
        tags: ['books', 'library', 'literature', 'data'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.7,
        ratingCount: 4500,
        usageCount: 230000,
        baseUrl: 'https://openlibrary.org',
        endpoints: [
            {
                path: '/search.json',
                method: 'GET',
                description: 'Search for books',
                parameters: [
                    { name: 'q', type: 'query', required: true, description: 'Search term' }
                ]
            }
        ],
        documentation: 'https://openlibrary.org/developers/api'
    },
    {
        id: 'swapi',
        name: 'Star Wars API',
        provider: 'SWAPI',
        description: 'Database of Star Wars films, characters, planets, and more',
        category: 'Entertainment',
        tags: ['star wars', 'movies', 'sci-fi', 'data'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.8,
        ratingCount: 6700,
        usageCount: 345000,
        baseUrl: 'https://swapi.py.dev/api',
        endpoints: [
            {
                path: '/people/{id}/',
                method: 'GET',
                description: 'Get a person',
                parameters: [
                    { name: 'id', type: 'path', required: true, description: 'Person ID' }
                ]
            },
            {
                path: '/planets/{id}/',
                method: 'GET',
                description: 'Get a planet',
                parameters: [
                    { name: 'id', type: 'path', required: true, description: 'Planet ID' }
                ]
            }
        ],
        documentation: 'https://swapi.dev/documentation'
    },
    {
        id: 'rickandmorty',
        name: 'Rick and Morty API',
        provider: 'RickAndMortyAPI',
        description: 'Information about the TV show Rick and Morty',
        category: 'Entertainment',
        tags: ['tv', 'animation', 'comedy', 'data'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.9,
        ratingCount: 8900,
        usageCount: 520000,
        baseUrl: 'https://rickandmortyapi.com/api',
        endpoints: [
            {
                path: '/character',
                method: 'GET',
                description: 'Get all characters'
            },
            {
                path: '/character/{id}',
                method: 'GET',
                description: 'Get a single character',
                parameters: [
                    { name: 'id', type: 'path', required: true, description: 'Character ID' }
                ]
            }
        ],
        documentation: 'https://rickandmortyapi.com/documentation'
    },
    {
        id: 'jikan',
        name: 'Jikan (Anime API)',
        provider: 'Jikan',
        description: 'The most complete MyAnimeList API for anime and manga',
        category: 'Entertainment',
        tags: ['anime', 'manga', 'japan', 'data'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.8,
        ratingCount: 7600,
        usageCount: 410000,
        baseUrl: 'https://api.jikan.moe/v4',
        endpoints: [
            {
                path: '/anime',
                method: 'GET',
                description: 'Search anime',
                parameters: [
                    { name: 'q', type: 'query', required: false, description: 'Search term' }
                ]
            }
        ],
        documentation: 'https://docs.api.jikan.moe/'
    },
    {
        id: 'giphy',
        name: 'Giphy API',
        provider: 'Giphy',
        description: 'The worlds largest library of animated GIFs',
        category: 'Media',
        tags: ['gifs', 'stickers', 'media', 'social'],
        authType: 'API Key',
        pricing: 'Freemium',
        ratingAverage: 4.7,
        ratingCount: 11200,
        usageCount: 980000,
        baseUrl: 'https://api.giphy.com/v1',
        endpoints: [
            {
                path: '/gifs/search',
                method: 'GET',
                description: 'Search for GIFs',
                parameters: [
                    { name: 'api_key', type: 'query', required: true, description: 'API Key' },
                    { name: 'q', type: 'query', required: true, description: 'Search term' }
                ]
            }
        ],
        documentation: 'https://developers.giphy.com/docs/api/'
    },
    {
        id: 'numbersapi',
        name: 'Numbers API',
        provider: 'NumbersAPI',
        description: 'Interesting facts about numbers',
        category: 'Trivia',
        tags: ['numbers', 'facts', 'trivia', 'math'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.4,
        ratingCount: 1800,
        usageCount: 67000,
        baseUrl: 'http://numbersapi.com',
        endpoints: [
            {
                path: '/{number}',
                method: 'GET',
                description: 'Get a fact about a number',
                parameters: [
                    { name: 'number', type: 'path', required: true, description: 'The number to get a fact about' }
                ]
            }
        ],
        documentation: 'http://numbersapi.com/'
    },
    {
        id: 'catapi',
        name: 'The Cat API',
        provider: 'That API Company',
        description: 'Access random cat images and breed information',
        category: 'Animals',
        tags: ['cats', 'pets', 'animals', 'images'],
        authType: 'API Key',
        pricing: 'Freemium',
        ratingAverage: 4.7,
        ratingCount: 5400,
        usageCount: 320000,
        baseUrl: 'https://api.thecatapi.com/v1',
        endpoints: [
            {
                path: '/images/search',
                method: 'GET',
                description: 'Get random cat image'
            },
            {
                path: '/breeds',
                method: 'GET',
                description: 'List all breeds'
            }
        ],
        documentation: 'https://docs.thecatapi.com/'
    },
    {
        id: 'agify',
        name: 'Agify.io',
        provider: 'Genderize Group',
        description: 'Predict the age of a person based on their name',
        category: 'Data',
        tags: ['demographics', 'name', 'age', 'ml'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.2,
        ratingCount: 1500,
        usageCount: 45000,
        baseUrl: 'https://api.agify.io',
        endpoints: [
            {
                path: '/',
                method: 'GET',
                description: 'Predict age',
                parameters: [
                    { name: 'name', type: 'query', required: true, description: 'The name to predict' }
                ]
            }
        ],
        documentation: 'https://agify.io/'
    }
];

async function seed() {
    try {
        await connectMongoose();
        console.log('Connected to MongoDB');

        // Clear existing APIs
        await MarketplaceApi.deleteMany({});
        console.log('Cleared existing marketplace APIs');

        // Insert new APIs
        const result = await MarketplaceApi.insertMany(publicApiCatalog);
        console.log(`Successfully inserted ${result.length} APIs`);

        // Create text index explicitly if needed, but schema handles it
        // await MarketplaceApi.createIndexes();

        console.log('Done!');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding database:', err);
        process.exit(1);
    }
}

seed();
