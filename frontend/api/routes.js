const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    // Read the cached route data
    const cachePath = path.join(__dirname, 'route_cache.json');
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    
    // Transform to the format the frontend expects
    const routes = [];
    const routeShapes = cache.route_shapes || {};
    const stopsByRoute = cache.stops_by_route || {};
    const routeMeta = cache.route_meta || {};
    const routeTotalLen = cache.route_total_len || {};
    
    for (const rid of Object.keys(routeShapes).sort()) {
      const meta = routeMeta[rid] || {};
      const stops = stopsByRoute[rid] || [];
      
      routes.push({
        route_id: rid,
        route_name: meta.name || rid,
        color: meta.color || '#000000',
        stop_count: stops.length,
        total_length_m: routeTotalLen[rid],
      });
    }
    
    res.status(200).json(routes);
  } catch (error) {
    console.error('Error serving routes:', error);
    res.status(500).json({ error: 'Failed to load routes' });
  }
};
