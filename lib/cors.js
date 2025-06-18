// lib/cors.js
import Cors from 'cors';
import initMiddleware from './init-middleware';

// Set your production domain here
const allowedOrigins = ['https://puerhcraft.com'];

const cors = initMiddleware(
  Cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

export default cors;