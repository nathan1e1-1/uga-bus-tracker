const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    const { route_id } = req.query;
    
    if (!route_id) {
      return res.status(400).json({ error: 'route_id required' });
    }
    
    // Read the cached route data
    const cachePath = path.join(__dirname, '..', 'route_cache.json');
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    
    const routeShapes = cache.route_shapes || {};
    const stopsByRoute = cache.stops_by_route || {};
    const routeMeta = cache.route_meta || {};
    const routeTotalLen = cache.route_total_len || {};
    
    const coords = routeShapes[route_id];
    const stops = stopsByRoute[route_id] || [];
    const meta = routeMeta[route_id] || {};
    
    if (!coords) {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    res.status(200).json({
      route_id: route_id,
      route_name: meta.name || route_id,
      color: meta.color || '#000000',
      polyline: coords.map(([lat, lng]) => ({ lat, lng })),
      stops: stops,
      total_length_m: routeTotalLen[route_id],
    });
  } catch (error) {
    console.error('Error serving route shape:', error);
    res.status(500).json({ error: 'Failed to load route shape' });
  }
};
