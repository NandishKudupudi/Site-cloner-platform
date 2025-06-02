require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sitecloner', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Models
const Clone = mongoose.model('Clone', new mongoose.Schema({
  url: String,
  clonedUrl: String,
  userId: String,
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: 'pending' }
}));

const User = mongoose.model('User', new mongoose.Schema({
  email: String,
  password: String,
  apiKey: String,
  plan: { type: String, default: 'free' },
  clonesLeft: { type: Number, default: 5 }
}));

// Utility Functions
async function cloneWebsite(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // Basic cloning - in a real app you'd need more sophisticated cloning
    const clonedHtml = $.html();
    
    // Save assets, rewrite links, etc. would go here
    return {
      html: clonedHtml,
      status: 'success'
    };
  } catch (error) {
    console.error('Cloning error:', error);
    return { status: 'error', message: error.message };
  }
}

// API Routes
app.post('/api/clone', async (req, res) => {
  try {
    const { url, apiKey } = req.body;
    
    // Verify user
    const user = await User.findOne({ apiKey });
    if (!user || user.clonesLeft <= 0) {
      return res.status(403).json({ error: 'Invalid API key or no clones left' });
    }
    
    // Create clone record
    const clone = new Clone({ url, userId: user._id });
    await clone.save();
    
    // Process cloning
    const result = await cloneWebsite(url);
    
    if (result.status === 'success') {
      clone.status = 'completed';
      clone.clonedUrl = `/clones/${clone._id}`;
      await clone.save();
      
      user.clonesLeft -= 1;
      await user.save();
      
      // In a real app, you'd save the HTML to storage
      return res.json({ 
        status: 'success',
        cloneId: clone._id,
        previewUrl: `/preview/${clone._id}`,
        downloadUrl: `/download/${clone._id}`
      });
    } else {
      clone.status = 'failed';
      await clone.save();
      return res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/clones', async (req, res) => {
  try {
    const { apiKey } = req.query;
    const user = await User.findOne({ apiKey });
    if (!user) return res.status(403).json({ error: 'Invalid API key' });
    
    const clones = await Clone.find({ userId: user._id }).sort({ createdAt: -1 });
    res.json(clones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Frontend Routes
app.get('/preview/:id', async (req, res) => {
  try {
    const clone = await Clone.findById(req.params.id);
    if (!clone) return res.status(404).send('Clone not found');
    
    // In a real app, you'd serve the actual cloned HTML
    res.send(`
      <html>
        <head>
          <title>Preview of ${clone.url}</title>
          <style>body { font-family: Arial; padding: 20px; }</style>
        </head>
        <body>
          <h1>Preview of ${clone.url}</h1>
          <p>This is a simulated preview. In the actual application, you'd see the cloned website here.</p>
          <iframe src="${clone.url}" style="width:100%; height:500px; border:1px solid #ccc;"></iframe>
        </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));