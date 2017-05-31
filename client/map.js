import mapboxgl from 'mapbox-gl';
import '!style!css!mapbox-gl/dist/mapbox-gl.css';
import chroma from 'chroma-js';
import $ from 'jquery';
import '!style!css!./map.css';

function App(mapbox_token) {
  // Zoom point at which map starts by default
  const zoomStart = 15;

  // Color scale
  let colors = [chroma('lime'), chroma('yellow'), chroma('red')];
  for (var i = 0; i < colors.length; i++) {
    colors[i] = colors[i].brighten(1.5);
  }
  let colorScale = chroma.scale(colors).mode('lab');

  // Map initialization
  mapboxgl.accessToken = mapbox_token;

  // osrmUrl
  var osrmUrl;

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
    osrmUrl = window.location.origin + '/api/route/v1';
    console.log(osrmUrl);
    map.addSource('routing', {
      type: 'vector',
      tiles: [routingUrl],
      maxZoom: 17,
      attribution: '&copy; AccessMap'
    });

    map.addLayer({
      id: 'roads',
      type: 'line',
      source: 'routing',
      'source-layer': 'routing_info',
      paint: {
        'line-color': {
          colorSpace: 'lab',
          property: 'grade',
          stops: [
            [-0.08333, colorScale(1.0).hex()],
            [-0.05, colorScale(0.5).hex()],
            [-0.00, colorScale(0.0).hex()],
            [0.05, colorScale(0.5).hex()],
            [0.08333, colorScale(1.0).hex()]
          ]
        },
        'line-width': {
          stops: [[12, 0.5], [16, 3], [20, 30]]
        },
        'line-opacity': {
          stops: [[8, 0.0], [zoomStart, 0.7], [20, 0.6]]
        }
      },
      layout: {
        'line-cap': 'round'
      }
    }, 'bridge-path-bg');
    setUpLayers(map);
  });
  // keeps track of geoJSON of origin point
  var origin
  // geoJSON of destination point
  var destination
  // popup asking whether current point is set to origin or destination
  var contextPopup
  // origin and destination markers initialized with LngLat [0,0]
  var el_origin = document.createElement('div');
  el_origin.id = 'origin_marker';
  var origin_marker = new mapboxgl.Marker(el_origin)
    .setLngLat([0, 0])
    .addTo(map);
  var el_destination = document.createElement('div');
  el_destination.id = 'destination_marker';
  var destination_marker = new mapboxgl.Marker(el_destination)
    .setLngLat([0, 0])
    .addTo(map);
  // when right click happens display a popup
  map.on('contextmenu', function (e) {
    if (contextPopup != undefined) {
        contextPopup.remove();
    }
    let html = `
      <div id="contextmenu">
      <ul style="list-style-type: none; padding-left: 0;">
      <li id="origin">
        <a>Set Origin</a>
      </li>
      <li id="destination">
        <a>Set Destination</a>
      </li>
      </ul>
      </div>
    `;
    contextPopup = new mapboxgl.Popup();
    contextPopup.setLngLat(e.lngLat)
      .setHTML(html)
      .addTo(map);
    // Set up listeners for click events
    let originEl = document.getElementById('origin');
    let destinationEl = document.getElementById('destination');
    // update origin marker and get route if destination is also set
    originEl.addEventListener('click', () => {
      origin = [e.lngLat.lng, e.lngLat.lat];
      origin_marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
      if (origin && destination) {
        getRoute(map, origin, destination, osrmUrl);
      }
      contextPopup.remove();
    });
    // update destination marker and get route if origin is also set
    destinationEl.addEventListener('click', () => {
      destination = [e.lngLat.lng, e.lngLat.lat];
      destination_marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
      if (origin && destination) {
        getRoute(map, origin, destination, osrmUrl);
      }
      contextPopup.remove();
    });
  });
}

function setUpLayers(map) {
  var sources = ['route-path', 'route-waypointpaths'];
  for (var source of sources) {
    map.addSource(source, {
      type: 'geojson',
      data: {
        "type": "FeatureCollection",
        "features": []
      }
    });
  }
  // add layer
  map.addLayer({
    id: 'route-waypointpaths',
    type: 'line',
    source: 'route-waypointpaths',
    paint: {
      'line-color': '#000',
      'line-opacity': 0.6,
      'line-width': {
        stops: [
          [12, 4],
          [15, 6],
          [20, 18]
        ]
      },
      'line-dasharray': {
        stops: [
          [12, [0, 1]],
          [15, [0, 1.5]],
          [20, [0, 4]]
        ]
      }
    },
    layout: {
      'line-cap': 'round'
    }
  });

  map.addLayer({
    id: 'route-outline',
    type: 'line',
    source: 'route-path',
    paint: {
      'line-color': '#000',
      'line-opacity': 0.7,
      'line-gap-width': {
        stops: [
          [12, 3],
          [15, 6],
          [20, 30]
        ]
      },
      'line-width': {
        stops: [
          [12, 1.5],
          [15, 2],
          [20, 3]
        ]
      }
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    }
  });
}

function getRoute(map, source, target, osrmUrl) {
  var url = osrmUrl + '/profile/';
  url += source[0] + ',' + source[1] + ';' + target[0] + ',' + target[1]
  url += '?geometries=geojson';
  console.log(url);
  var req = $.get(url);
  req.done(function (data) {
    console.log(data);
    drawRoute(map, source, target, data);
  });
}

function drawRoute(map, source, target, data) {
  let path = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: data.routes[0].geometry
    }]
  };
      // Path from origin/destination to route (e.g. dotted lines in gmaps)
      let pathCoords = path.features[0].geometry.coordinates;
      let originPath = [source,
                        pathCoords[0]];
      let destPath = [pathCoords[pathCoords.length - 1],
                      target];

      let waypointPaths = {
        type: 'FeatureCollection',
        features: []
      };

      for (var waypointPath of [originPath, destPath]) {
        waypointPaths.features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: waypointPath
          },
          properties: {}
        });
      }

      // Update the map data layers
      map.getSource('route-path').setData(path);
      map.getSource('route-waypointpaths').setData(waypointPaths);
}
module.exports = App;
