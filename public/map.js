function App(mapbox_token) {
  // Zoom point at which map starts by default
  const zoomStart = 15;
  // Map initialization
  mapboxgl.accessToken = mapbox_token;

  var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v8',
    center: [-122.333592, 47.605628],
    zoom: zoomStart
  });
  // Disable accidental map rotating / camera angle changes
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();

  map.on('load', function() {
    var bounds = map.getBounds().toArray();
    var bbox = bounds[0].concat(bounds[1]).join(',');

    // This is a hack to ensure that tile requests are made to the main site's
    // /tiles subdirectory. Using just '/tiles/(...).mvt' results in
    // cross-origin errors
    if (!window.location.origin) {
      window.location.origin = window.location.protocol + "//"
        + window.location.hostname
        + (window.location.port ? ':' + window.location.port : '');
    }
    var routingUrl = window.location.origin + '/tiles/routing/{z}/{x}/{y}.pbf';

    map.addSource('routing', {
      type: 'vector',
      tiles: [routingUrl],
      attribution: '&copy; AccessMap'
    });

    map.addLayer({
      id: 'roads',
      type: 'line',
      source: 'routing',
      'source-layer': 'routing_info',
      paint: {
        'line-color': '#000000',
        'line-width': {
          stops: [[12, 0.5], [16, 3], [20, 20]]
        },
        'line-opacity': {
          stops: [[13, 0.0], [zoomStart, 0.4], [20, 0.5]]
        },
      },
      layout: {
        'line-cap': 'round'
      }
    }, 'bridge-path-bg');
  });
}
