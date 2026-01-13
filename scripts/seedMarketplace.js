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
        id: 'activity-suggestions',
        name: 'Activity API',
        provider: 'Dovahkiin',
        description: 'Random activity suggestions for when you are bored',
        category: 'Lifestyle',
        tags: ['activities', 'suggestions', 'fun'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.5,
        ratingCount: 3200,
        usageCount: 125000,
        baseUrl: 'https://www.activityapi.com/api',
        endpoints: [
            {
                path: '/activity',
                method: 'GET',
                description: 'Get a random activity'
            }
        ],
        documentation: 'https://www.activityapi.com/'
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
    },
    // --- DEVELOPMENT TOOLS ---
    {
        id: 'reqres',
        name: 'ReqRes',
        provider: 'Ben Howdle',
        description: 'A hosted REST-API ready to respond to your AJAX requests',
        category: 'Development',
        tags: ['testing', 'mock', 'api', 'rest'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.6,
        ratingCount: 5200,
        usageCount: 850000,
        baseUrl: 'https://reqres.in/api',
        endpoints: [
            { path: '/users', method: 'GET', description: 'List users' },
            { path: '/users/{id}', method: 'GET', description: 'Single user' }
        ],
        documentation: 'https://reqres.in/'
    },
    {
        id: 'httpbin',
        name: 'Httpbin',
        provider: 'Postman',
        description: 'A simple HTTP Request & Response Service',
        category: 'Development',
        tags: ['testing', 'http', 'debug', 'utility'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.8,
        ratingCount: 12000,
        usageCount: 2500000,
        baseUrl: 'https://httpbin.org',
        endpoints: [
            { path: '/get', method: 'GET', description: 'Returns GET data' },
            { path: '/post', method: 'POST', description: 'Returns POST data' },
            { path: '/status/{code}', method: 'GET', description: 'Returns given status code' }
        ],
        documentation: 'https://httpbin.org/'
    },
    {
        id: 'jsonbin',
        name: 'JSONBin.io',
        provider: 'JSONBin',
        description: 'Free JSON Storage Service',
        category: 'Development',
        tags: ['storage', 'json', 'data', 'database'],
        authType: 'API Key',
        pricing: 'Freemium',
        baseUrl: 'https://api.jsonbin.io/v3',
        endpoints: [
            { path: '/b/{id}', method: 'GET', description: 'Get a bin' }
        ],
        documentation: 'https://jsonbin.io/api-reference'
    },
    {
        id: 'ipstack',
        name: 'IPstack',
        provider: 'apilayer',
        description: 'Real-time IP Address Geolocation API',
        category: 'Data',
        tags: ['ip', 'geolocation', 'location'],
        authType: 'API Key',
        pricing: 'Freemium',
        baseUrl: 'http://api.ipstack.com',
        endpoints: [
            { path: '/{ip}', method: 'GET', description: 'Check IP' }
        ],
        documentation: 'https://ipstack.com/documentation'
    },
    // --- AI & ML ---
    {
        id: 'genderize',
        name: 'Genderize.io',
        provider: 'Genderize Group',
        description: 'Predict the gender of a person based on their name',
        category: 'AI',
        tags: ['geography', 'gender', 'ml'],
        authType: 'None',
        pricing: 'Free',
        baseUrl: 'https://api.genderize.io',
        endpoints: [
            { path: '/', method: 'GET', description: 'Predict gender' }
        ],
        documentation: 'https://genderize.io/'
    },
    {
        id: 'nationalize',
        name: 'Nationalize.io',
        provider: 'Genderize Group',
        description: 'Predict the nationality of a person based on their name',
        category: 'AI',
        tags: ['geography', 'nationality', 'ml'],
        authType: 'None',
        pricing: 'Free',
        baseUrl: 'https://api.nationalize.io',
        endpoints: [
            { path: '/', method: 'GET', description: 'Predict nationality' }
        ],
        documentation: 'https://nationalize.io/'
    },
    {
        id: 'adviceslip',
        name: 'Advice Slip',
        provider: 'Advice Slip',
        description: 'Random advice generator',
        category: 'AI',
        tags: ['advice', 'fun', 'wisdom'],
        authType: 'None',
        pricing: 'Free',
        baseUrl: 'https://api.adviceslip.com/advice',
        endpoints: [
            { path: '/', method: 'GET', description: 'Get random advice' }
        ],
        documentation: 'https://adviceslip.com/'
    },
    {
        id: 'kanye-rest',
        name: 'Kanye Rest',
        provider: 'Andrew @ajzbc',
        description: 'Random Kanye West quotes API',
        category: 'Entertainment',
        tags: ['quotes', 'music', 'fun'],
        baseUrl: 'https://api.kanye.rest',
        endpoints: [
            { path: '/', method: 'GET', description: 'Get random quote' }
        ]
    },
    // --- FINANCE ---
    {
        id: 'marketstack',
        name: 'Marketstack',
        provider: 'apilayer',
        description: 'Real-time, Intraday & Historical Stock Market Data API',
        category: 'Finance',
        tags: ['stocks', 'market', 'historical'],
        authType: 'API Key',
        pricing: 'Freemium',
        baseUrl: 'http://api.marketstack.com/v1',
        endpoints: [
            { path: '/eod', method: 'GET', description: 'End-of-day data' }
        ],
        documentation: 'https://marketstack.com/documentation'
    },
    {
        id: 'fixer',
        name: 'Fixer.io',
        provider: 'apilayer',
        description: 'Foreign Exchange Rates and Currency Conversion API',
        category: 'Finance',
        tags: ['currency', 'forex', 'conversion'],
        authType: 'API Key',
        pricing: 'Freemium',
        baseUrl: 'http://data.fixer.io/api',
        endpoints: [
            { path: '/latest', method: 'GET', description: 'Latest rates' }
        ],
        documentation: 'https://fixer.io/documentation'
    },
    {
        id: 'frankfurter',
        name: 'Frankfurter',
        provider: 'Frankfurter',
        description: 'Open source API for current and historical foreign exchange rates',
        category: 'Finance',
        tags: ['currency', 'forex', 'open-source'],
        authType: 'None',
        pricing: 'Free',
        baseUrl: 'https://api.frankfurter.app',
        endpoints: [
            { path: '/latest', method: 'GET', description: 'Latest rates' }
        ],
        documentation: 'https://www.frankfurter.app/docs/'
    },
    {
        id: 'nager-date',
        name: 'Nager.Date',
        provider: 'Nager',
        description: 'Public Holidays API',
        category: 'Data',
        tags: ['holidays', 'calendar', 'global'],
        authType: 'None',
        pricing: 'Free',
        baseUrl: 'https://date.nager.at/api/v3',
        endpoints: [
            { path: '/PublicHolidays/{year}/{countryCode}', method: 'GET', description: 'Get public holidays' }
        ],
        documentation: 'https://date.nager.at/swagger/index.html'
    },
    // --- ENTERTAINMENT & FUN ---
    {
        id: 'chucknorris',
        name: 'Chuck Norris Facts',
        provider: 'Chuck Norris API',
        description: 'Hand-curated Chuck Norris facts',
        category: 'Entertainment',
        tags: ['jokes', 'fun', 'chuck-norris'],
        authType: 'None',
        pricing: 'Free',
        baseUrl: 'https://api.chucknorris.io/jokes',
        endpoints: [
            { path: '/random', method: 'GET', description: 'Get random fact' }
        ],
        documentation: 'https://api.chucknorris.io/'
    },
    {
        id: 'dadjokes',
        name: 'I Can Haz Dad Joke',
        provider: 'DadJokes',
        description: 'The largest selection of dad jokes on the internet',
        category: 'Entertainment',
        tags: ['jokes', 'dad-jokes', 'humor'],
        authType: 'None',
        pricing: 'Free',
        baseUrl: 'https://icanhazdadjoke.com',
        endpoints: [
            { path: '/', method: 'GET', description: 'Get random joke' }
        ],
        documentation: 'https://icanhazdadjoke.com/api'
    },
    {
        id: 'opentdb',
        name: 'Open Trivia DB',
        provider: 'PIXELCAN',
        description: 'User-contributed trivia question database',
        category: 'Entertainment',
        tags: ['trivia', 'games', 'quiz'],
        authType: 'None',
        pricing: 'Free',
        baseUrl: 'https://opentdb.com/api.php',
        endpoints: [
            { path: '/', method: 'GET', description: 'Get trivia questions' }
        ],
        documentation: 'https://opentdb.com/api_config.php'
    },
    {
        id: 'tmdb',
        name: 'The Movie Database',
        provider: 'TMDB',
        description: 'The Movie Database (TMDB) is a community built movie and TV database',
        category: 'Entertainment',
        tags: ['movies', 'tv', 'media', 'data'],
        authType: 'API Key',
        pricing: 'Free',
        baseUrl: 'https://api.themoviedb.org/3',
        endpoints: [
            { path: '/movie/popular', method: 'GET', description: 'Popular movies' },
            { path: '/search/movie', method: 'GET', description: 'Search movies' }
        ],
        documentation: 'https://developers.themoviedb.org/3'
    },
    {
        id: 'tvmaze',
        name: 'TVmaze',
        provider: 'TVmaze',
        description: 'TV show data and schedules',
        category: 'Entertainment',
        tags: ['tv', 'shows', 'media'],
        authType: 'None',
        pricing: 'Free',
        baseUrl: 'https://api.tvmaze.com',
        endpoints: [
            { path: '/search/shows', method: 'GET', description: 'Search shows' },
            { path: '/schedule', method: 'GET', description: 'Show schedule' }
        ],
        documentation: 'https://www.tvmaze.com/api'
    },
    // --- IMAGES & ART ---
    {
        id: 'picsum',
        name: 'Lorem Picsum',
        provider: 'Picsum',
        description: 'The Lorem Ipsum for photos',
        category: 'Images',
        tags: ['placeholder', 'images', 'photos'],
        baseUrl: 'https://picsum.photos',
        endpoints: [
            { path: '/v2/list', method: 'GET', description: 'List images' },
            { path: '/{width}/{height}', method: 'GET', description: 'Get image' }
        ],
        documentation: 'https://picsum.photos/'
    },
    {
        id: 'dicebear',
        name: 'DiceBear',
        provider: 'DiceBear',
        description: 'Avatar library for designers and developers',
        category: 'Images',
        tags: ['avatars', 'svg', 'design'],
        baseUrl: 'https://api.dicebear.com/7.x',
        endpoints: [
            { path: '/{style}/svg', method: 'GET', description: 'Generate avatar' }
        ],
        documentation: 'https://www.dicebear.com/how-to-use/api/'
    },
    {
        id: 'artic',
        name: 'Art Institute of Chicago',
        provider: 'Art Institute of Chicago',
        description: 'Public API for the Art Institute of Chicago collection',
        category: 'Images',
        tags: ['art', 'museum', 'culture'],
        baseUrl: 'https://api.artic.edu/api/v1',
        endpoints: [
            { path: '/artworks', method: 'GET', description: 'List artworks' }
        ],
        documentation: 'https://api.artic.edu/docs/'
    },
    {
        id: 'metmus',
        name: 'Met Museum',
        provider: 'Metropolitan Museum of Art',
        description: 'Open Access collection of the Metropolitan Museum of Art',
        category: 'Images',
        tags: ['art', 'museum', 'culture'],
        baseUrl: 'https://collectionapi.metmuseum.org/public/collection/v1',
        endpoints: [
            { path: '/objects', method: 'GET', description: 'List objects' }
        ],
        documentation: 'https://metmuseum.github.io/'
    },
    // --- SCIENCES & NATURE ---
    {
        id: 'spacex',
        name: 'SpaceX API',
        provider: 'r-spacex',
        description: 'Open Source REST API for SpaceX launch, rocket, core, capsule, starlink and launchpad data',
        category: 'Science',
        tags: ['space', 'spacex', 'rockets'],
        baseUrl: 'https://api.spacexdata.com/v4',
        endpoints: [
            { path: '/launches/latest', method: 'GET', description: 'Latest launch' },
            { path: '/rockets', method: 'GET', description: 'Rockets list' }
        ],
        documentation: 'https://github.com/r-spacex/SpaceX-API'
    },
    {
        id: 'airvisual',
        name: 'IQAir (AirVisual)',
        provider: 'IQAir',
        description: 'Real-time air quality data (AQI) and weather data',
        category: 'Science',
        tags: ['environment', 'air-quality', 'pollution'],
        authType: 'API Key',
        baseUrl: 'https://api.airvisual.com/v2',
        endpoints: [
            { path: '/nearest_city', method: 'GET', description: 'Nearest city AQI' }
        ],
        documentation: 'https://api-docs.iqair.com/'
    },
    {
        id: 'sunrisesunset',
        name: 'Sunrise-Sunset',
        provider: 'Sunrise-Sunset.org',
        description: 'Sunset and sunrise times for a given latitude and longitude',
        category: 'Science',
        tags: ['solar', 'time', 'geography'],
        baseUrl: 'https://api.sunrise-sunset.org',
        endpoints: [
            {
                path: '/json',
                method: 'GET',
                description: 'Get solar data',
                parameters: [
                    { name: 'lat', type: 'query', required: true, description: 'Latitude' },
                    { name: 'lng', type: 'query', required: true, description: 'Longitude' }
                ]
            }
        ],
        documentation: 'https://sunrise-sunset.org/api'
    },
    // --- FOOD & DRINK ---
    {
        id: 'mealy',
        name: 'TheMealDB',
        provider: 'TheMealDB',
        description: 'An open, crowd-sourced database of Recipes from around the world',
        category: 'Food',
        tags: ['recipes', 'cooking', 'food'],
        baseUrl: 'https://www.themealdb.com/api/json/v1/1',
        endpoints: [
            { path: '/random.php', method: 'GET', description: 'Random meal' },
            { path: '/search.php', method: 'GET', description: 'Search meal' }
        ],
        documentation: 'https://www.themealdb.com/api.php'
    },
    {
        id: 'cocktaildb',
        name: 'TheCocktailDB',
        provider: 'TheCocktailDB',
        description: 'An open, crowd-sourced database of Drinks and Cocktails from around the world',
        category: 'Food',
        tags: ['drinks', 'cocktails', 'recipes'],
        baseUrl: 'https://www.thecocktaildb.com/api/json/v1/1',
        endpoints: [
            { path: '/random.php', method: 'GET', description: 'Random cocktail' }
        ],
        documentation: 'https://www.thecocktaildb.com/api.php'
    },
    // --- TRAVEL & GEODATA ---
    {
        id: 'teleport',
        name: 'Teleport',
        provider: 'Teleport',
        description: 'API for city data, including quality of life, salaries, and more',
        category: 'Travel',
        tags: ['cities', 'salaries', 'quality-of-life'],
        baseUrl: 'https://api.teleport.org/api',
        endpoints: [
            { path: '/urban_areas', method: 'GET', description: 'Urban areas' }
        ],
        documentation: 'https://developers.teleport.org/api/'
    },
    {
        id: 'universities',
        name: 'Universities API',
        provider: 'Hipo',
        description: 'A global database of university information',
        category: 'Education',
        tags: ['education', 'universities', 'global'],
        baseUrl: 'http://universities.hipolabs.com',
        endpoints: [
            { path: '/search', method: 'GET', description: 'Search universities' }
        ],
        documentation: 'https://github.com/Hipo/university-domains-list'
    },
    {
        id: 'dictionary',
        name: 'Free Dictionary API',
        provider: 'DictionaryAPI.dev',
        description: 'Free English Dictionary API',
        category: 'Education',
        tags: ['dictionary', 'words', 'definitions'],
        baseUrl: 'https://api.dictionaryapi.dev/api/v2/entries/en',
        endpoints: [
            { path: '/{word}', method: 'GET', description: 'Get definition' }
        ],
        documentation: 'https://dictionaryapi.dev/'
    },
    {
        id: 'bible',
        name: 'Bible-Api',
        provider: 'Bible-Api',
        description: 'Free Bible API with JSON support',
        category: 'Data',
        tags: ['religion', 'bible', 'text'],
        baseUrl: 'https://bible-api.com',
        endpoints: [
            { path: '/{citation}', method: 'GET', description: 'Get verse' }
        ],
        documentation: 'https://bible-api.com/'
    },
    // --- ADDING MORE TO REACH 80+ ---
    {
        id: 'evilinsult',
        name: 'Evil Insult Generator',
        provider: 'Evil Insult',
        description: 'Generate evil insults',
        category: 'Entertainment',
        tags: ['insults', 'fun', 'humor'],
        baseUrl: 'https://evilinsult.com/generate_insult.php',
        endpoints: [
            { path: '/', method: 'GET', description: 'Get insult' }
        ],
        documentation: 'https://evilinsult.com/api/'
    },
    {
        id: 'advice-api',
        name: 'Advice Slip v2',
        provider: 'Advice Slip',
        description: 'Advice Slip generation',
        category: 'Lifestyle',
        tags: ['advice', 'life'],
        baseUrl: 'https://api.adviceslip.com/advice',
        endpoints: [
            { path: '/', method: 'GET', description: 'Get advice' }
        ]
    },
    {
        id: 'yesno',
        name: 'Yes No API',
        provider: 'Yes No WTF',
        description: 'Force a random yes or no answer',
        category: 'Entertainment',
        tags: ['decisions', 'fun'],
        baseUrl: 'https://yesno.wtf/api',
        endpoints: [
            { path: '/', method: 'GET', description: 'Get answer' }
        ]
    },
    {
        id: 'cat-facts',
        name: 'Cat Facts API',
        provider: 'Cat Facts Ninja',
        description: 'Daily facts about cats',
        category: 'Animals',
        tags: ['cats', 'facts'],
        baseUrl: 'https://catfact.ninja',
        endpoints: [
            { path: '/fact', method: 'GET', description: 'Random fact' }
        ]
    },
    {
        id: 'dog-facts',
        name: 'Dog Facts API',
        provider: 'Kinduff',
        description: 'Random dog facts',
        category: 'Animals',
        tags: ['dogs', 'facts'],
        baseUrl: 'https://dog-api.kinduff.com/api/facts',
        endpoints: [
            { path: '/', method: 'GET', description: 'Random fact' }
        ]
    },
    {
        id: 'us-population',
        name: 'DataUSA API',
        provider: 'DataUSA',
        description: 'Access public US government data',
        category: 'Data',
        tags: ['government', 'usa', 'population'],
        baseUrl: 'https://datausa.io/api/data',
        endpoints: [
            { path: '/', method: 'GET', description: 'Get data' }
        ]
    },
    {
        id: 'zippopotamus',
        name: 'Zippopotamus',
        provider: 'Zippopotamus',
        description: 'Free postal code information',
        category: 'Data',
        tags: ['zipcode', 'geography'],
        baseUrl: 'http://api.zippopotam.us',
        endpoints: [
            { path: '/us/{zip}', method: 'GET', description: 'Get US zip data' }
        ]
    },
    {
        id: 'open-ligue-db',
        name: 'OpenLigaDB',
        provider: 'OpenLigaDB',
        description: 'Open data for football leagues',
        category: 'Sports',
        tags: ['football', 'soccer', 'sports'],
        baseUrl: 'https://api.openligadb.de',
        endpoints: [
            { path: '/getmatchdata/bl1/2023', method: 'GET', description: 'Bundesliga data' }
        ]
    },
    {
        id: 'official-joke-api',
        name: 'Official Joke API',
        provider: 'David Katz',
        description: 'A simple API for random jokes (General, Programming, Knock-knock)',
        category: 'Entertainment',
        tags: ['jokes', 'humor', 'fun'],
        authType: 'None',
        pricing: 'Free',
        baseUrl: 'https://official-joke-api.appspot.com',
        endpoints: [
            { path: '/random_joke', method: 'GET', description: 'Get a random joke' },
            { path: '/jokes/programming/random', method: 'GET', description: 'Get a programming joke' }
        ],
        documentation: 'https://github.com/15Dkatz/official_joke_api'
    },
    {
        id: 'cryptocompare',
        name: 'CryptoCompare',
        provider: 'CryptoCompare',
        description: 'Cryptocurrency market data',
        category: 'Finance',
        tags: ['crypto', 'bitcoin'],
        baseUrl: 'https://min-api.cryptocompare.com/data',
        endpoints: [
            { path: '/price', method: 'GET', description: 'Get price' }
        ]
    },
    {
        id: 'wallstreetbets',
        name: 'WSB API',
        provider: 'Tradestie',
        description: 'Wall Street Bets sentiment analysis',
        category: 'Finance',
        tags: ['stocks', 'reddit', 'sentiment'],
        baseUrl: 'https://tradestie.com/api/v1/apps/reddit',
        endpoints: [
            { path: '/', method: 'GET', description: 'Get sentiment' }
        ]
    },
    {
        id: 'itunes',
        name: 'iTunes Search API',
        provider: 'Apple',
        description: 'Search for music and movies on iTunes',
        category: 'Media',
        tags: ['music', 'itunes', 'apple'],
        baseUrl: 'https://itunes.apple.com',
        endpoints: [
            { path: '/search', method: 'GET', description: 'Search' }
        ]
    },
    {
        id: 'scryfall',
        name: 'Scryfall API',
        provider: 'Scryfall',
        description: 'Magic: The Gathering card data',
        category: 'Games',
        tags: ['mtg', 'cards', 'games'],
        baseUrl: 'https://api.scryfall.com',
        endpoints: [
            { path: '/cards/random', method: 'GET', description: 'Random card' }
        ]
    },
    {
        id: 'freetogame',
        name: 'Free-To-Play Games API',
        provider: 'FreeToGame',
        description: 'Access a massive database of free-to-play games and news',
        category: 'Games',
        tags: ['games', 'f2p', 'gaming', 'database'],
        authType: 'None',
        pricing: 'Free',
        baseUrl: 'https://www.freetogame.com/api',
        endpoints: [
            { path: '/games', method: 'GET', description: 'Get all games' },
            { path: '/game?id={id}', method: 'GET', description: 'Get game details', parameters: [{ name: 'id', type: 'query', required: true }] }
        ],
        documentation: 'https://www.freetogame.com/api-doc'
    },
    {
        id: 'deck-of-cards',
        name: 'Deck of Cards API',
        provider: 'Deck of Cards',
        description: 'Simulate decks of cards',
        category: 'Games',
        tags: ['cards', 'deck'],
        baseUrl: 'https://deckofcardsapi.com/api/deck',
        endpoints: [
            { path: '/new/shuffle', method: 'GET', description: 'Shuffle new' }
        ]
    },
    {
        id: 'boardgamegeek',
        name: 'BoardGameGeek API',
        provider: 'BoardGameGeek',
        description: 'Board game data from BGG',
        category: 'Games',
        tags: ['boardgames', 'games'],
        baseUrl: 'https://boardgamegeek.com/xmlapi2',
        endpoints: [
            { path: '/thing', method: 'GET', description: 'Get thing' }
        ]
    },
    {
        id: 'faker-api',
        name: 'Faker API',
        provider: 'FakerAPI.it',
        description: 'Generate fake data',
        category: 'Development',
        tags: ['test-data', 'faker'],
        baseUrl: 'https://fakerapi.it/api/v1',
        endpoints: [
            { path: '/persons', method: 'GET', description: 'Fake persons' }
        ]
    },
    {
        id: 'restfox',
        name: 'RestFox API',
        provider: 'RestFox',
        description: 'Mock data generation',
        category: 'Development',
        tags: ['mock', 'rest'],
        baseUrl: 'https://api.restfox.dev',
        endpoints: [
            { path: '/ping', method: 'GET', description: 'Ping' }
        ]
    },
    {
        id: 'ipify',
        name: 'Ipify',
        provider: 'Ipify',
        description: 'Simple IP address API',
        category: 'Tools',
        tags: ['ip', 'utility'],
        baseUrl: 'https://api.ipify.org',
        endpoints: [
            { path: '/', method: 'GET', description: 'Get IP' }
        ]
    },
    {
        id: 'updown-io',
        name: 'Updown.io',
        provider: 'Updown.io',
        description: 'Monitoring API',
        category: 'Development',
        tags: ['monitoring', 'status'],
        baseUrl: 'https://updown.io/api',
        endpoints: [
            { path: '/checks', method: 'GET', description: 'Get checks' }
        ]
    },
    {
        id: 'breach-api',
        name: 'Have I Been Pwned',
        provider: 'Troy Hunt',
        description: 'Check for data breaches',
        category: 'Security',
        tags: ['security', 'breach'],
        baseUrl: 'https://haveibeenpwned.com/api/v3',
        endpoints: [
            { path: '/breaches', method: 'GET', description: 'List breaches' }
        ]
    },
    {
        id: 'hackernews',
        name: 'Hacker News API',
        provider: 'Y Combinator',
        description: 'Hacker News public API',
        category: 'News',
        tags: ['tech', 'news', 'hacker-news'],
        baseUrl: 'https://hacker-news.firebaseio.com/v0',
        endpoints: [
            { path: '/topstories.json', method: 'GET', description: 'Top stories' }
        ]
    },
    {
        id: 'reddit-api',
        name: 'Reddit API',
        provider: 'Reddit',
        description: 'Reddit JSON API',
        category: 'Social',
        tags: ['reddit', 'social-media'],
        baseUrl: 'https://www.reddit.com',
        endpoints: [
            { path: '/r/{subreddit}/.json', method: 'GET', description: 'Subreddit data' }
        ]
    },
    {
        id: 'wikipedia',
        name: 'Wikipedia API',
        provider: 'Wikimedia',
        description: 'MediaWiki API for Wikipedia',
        category: 'Education',
        tags: ['wiki', 'knowledge'],
        baseUrl: 'https://en.wikipedia.org/w/api.php',
        endpoints: [
            { path: '/', method: 'GET', description: 'Generic API' }
        ]
    },
    {
        id: 'stack-exchange',
        name: 'Stack Exchange API',
        provider: 'Stack Overflow',
        description: 'Stack Overflow and Stack Exchange data',
        category: 'Development',
        tags: ['qa', 'stackoverflow'],
        baseUrl: 'https://api.stackexchange.com/2.3',
        endpoints: [
            { path: '/questions', method: 'GET', description: 'Questions' }
        ]
    },
    {
        id: 'world-clock',
        name: 'World Clock API',
        provider: 'WorldClockAPI',
        description: 'Get current time across timezones',
        category: 'Tools',
        tags: ['time', 'clock'],
        baseUrl: 'http://worldclockapi.com/api/json',
        endpoints: [
            { path: '/est/now', method: 'GET', description: 'EST Time' }
        ]
    },
    {
        id: 'country-layer',
        name: 'CountryLayer API',
        provider: 'apilayer',
        description: 'A simple country data API',
        category: 'Data',
        tags: ['countries', 'geography'],
        baseUrl: 'http://api.countrylayer.com/v2',
        endpoints: [
            { path: '/all', method: 'GET', description: 'All countries' }
        ]
    },
    {
        id: 'rest-countries-v2',
        name: 'REST Countries v2',
        provider: 'REST Countries',
        description: 'Additional country data',
        category: 'Data',
        tags: ['countries', 'geography'],
        baseUrl: 'https://restcountries.com/v2',
        endpoints: [
            { path: '/all', method: 'GET', description: 'All countries' }
        ]
    },
    {
        id: 'ghibli-api',
        name: 'Studio Ghibli API',
        provider: 'Studio Ghibli',
        description: 'Data from Studio Ghibli films',
        category: 'Entertainment',
        tags: ['anime', 'movies', 'ghibli'],
        baseUrl: 'https://ghibliapi.vercel.app',
        endpoints: [
            { path: '/films', method: 'GET', description: 'Films' }
        ]
    },
    {
        id: 'final-fantasy-api',
        name: 'Final Fantasy API',
        provider: 'MoogleAPI',
        description: 'Final Fantasy universe data',
        category: 'Games',
        tags: ['ff', 'rpg', 'games'],
        baseUrl: 'https://moogleapi.com/api/v1',
        endpoints: [
            { path: '/characters', method: 'GET', description: 'Characters' }
        ]
    },
    {
        id: 'marvel-api',
        name: 'Marvel API',
        provider: 'Marvel',
        description: 'Access the Marvel Comics world (Requires Public/Private Keys and Hash)',
        category: 'Entertainment',
        tags: ['marvel', 'comics', 'superheroes'],
        authType: 'API Key',
        baseUrl: 'https://gateway.marvel.com/v1/public',
        endpoints: [
            { path: '/characters', method: 'GET', description: 'Characters' }
        ],
        documentation: 'https://developer.marvel.com/'
    },
    {
        id: 'disney-api',
        name: 'Disney API',
        provider: 'Disney',
        description: 'Disney characters data',
        category: 'Entertainment',
        tags: ['disney', 'characters'],
        baseUrl: 'https://api.disneyapi.dev',
        endpoints: [
            { path: '/character', method: 'GET', description: 'Characters' }
        ]
    },
    {
        id: 'clash-of-clans',
        name: 'Clash of Clans API',
        provider: 'Supercell',
        description: 'Official Clash of Clans API (Requires API Key)',
        category: 'Games',
        tags: ['clash-of-clans', 'supercell'],
        authType: 'API Key',
        baseUrl: 'https://api.clashofclans.com/v1',
        endpoints: [
            { path: '/clans', method: 'GET', description: 'Search clans' }
        ]
    },
    {
        id: 'fortnite-api',
        name: 'Fortnite API',
        provider: 'FortniteAPI.com',
        description: 'Fortnite shop and stats data (No Key required for some endpoints)',
        category: 'Games',
        tags: ['fortnite', 'battle-royale'],
        authType: 'None',
        baseUrl: 'https://fortnite-api.com/v2',
        endpoints: [
            { path: '/shop/br', method: 'GET', description: 'BR Shop' }
        ]
    },
    {
        id: 'valorant-api',
        name: 'Valorant API',
        provider: 'ValorantAPI.com',
        description: 'Valorant content and assets',
        category: 'Games',
        tags: ['valorant', 'fps', 'assets'],
        baseUrl: 'https://valorant-api.com/v1',
        endpoints: [
            { path: '/agents', method: 'GET', description: 'Agents' }
        ]
    },
    {
        id: 'apex-legends',
        name: 'Apex Legends API',
        provider: 'Mozambiquehe.re',
        description: 'Apex Legends player stats',
        category: 'Games',
        tags: ['apex', 'legends', 'stats'],
        baseUrl: 'https://api.mozambiquehe.re',
        endpoints: [
            { path: '/maprotation', method: 'GET', description: 'Map rotation' }
        ]
    },
    {
        id: 'pubg-api',
        name: 'PUBG API',
        provider: 'PUBG Studios',
        description: 'Official PUBG data API (Requires API Key)',
        category: 'Games',
        tags: ['pubg', 'battle-royale'],
        authType: 'API Key',
        baseUrl: 'https://api.pubg.com/shards/steam/matches',
        endpoints: [
            { path: '/', method: 'GET', description: 'Matches' }
        ]
    },
    {
        id: 'league-of-legends',
        name: 'Riot Games API',
        provider: 'Riot Games',
        description: 'League of Legends data (Requires API Key)',
        category: 'Games',
        tags: ['lol', 'riot', 'league'],
        authType: 'API Key',
        baseUrl: 'https://{region}.api.riotgames.com/lol',
        endpoints: [
            { path: '/summoner/v4/summoners/by-name/{name}', method: 'GET', description: 'Summoner' }
        ]
    },
    {
        id: 'genshin-impact',
        name: 'Genshin Impact API',
        provider: 'Genshin.dev',
        description: 'Genshin Impact game assets',
        category: 'Games',
        tags: ['genshin', 'rpg', 'anime'],
        baseUrl: 'https://api.genshin.dev',
        endpoints: [
            { path: '/characters', method: 'GET', description: 'Characters' }
        ]
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
        // Ensure every API has a provider
        publicApiCatalog.forEach(api => {
            if (!api.provider) {
                api.provider = api.name || api.id || 'Unknown Provider';
            }
        });

        const result = await MarketplaceApi.insertMany(publicApiCatalog);
        console.log(`Successfully inserted ${result.length} APIs`);
        require('fs').writeFileSync('seed_success.txt', `Inserted ${result.length} APIs`);

        // Create text index explicitly if needed, but schema handles it
        // await MarketplaceApi.createIndexes();

        console.log('Done!');
        process.exit(0);
    } catch (err) {
        const errorMsg = `Error seeding database: ${err.message}\n${JSON.stringify(err.errors, null, 2)}`;
        require('fs').writeFileSync('seed_error.txt', errorMsg);
        console.error('Error seeding database:', err);
        process.exit(1);
    }
}

seed();
