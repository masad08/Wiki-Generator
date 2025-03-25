import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import wikiRoutes from './routes/wiki';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));


// Create created_wikis directory if it doesn't exist
const wikiDir = path.join(__dirname, '../../..', 'created_wikis');
fs.ensureDirSync(wikiDir);

// Static files
app.use('/wikis', express.static(wikiDir));

// Routes
app.use('/api/wiki', wikiRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app; 