const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    const { route_id } = req.query;
    
    // For now, return empty array since we don't have live bus data
    // without the Python backend running
    res.status(200).json([]);
  } catch (error) {
    console.error('Error serving buses:', error);
    res.status(500).json({ error: 'Failed to load buses' });
  }
};
