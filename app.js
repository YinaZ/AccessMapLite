var express = require('express');
var app = express();

var exphbs = require('express-handlebars');
var path = require('path');

var bodyParser = require('body-parser');
app.use(bodyParser.json());

var Sequelize = require('sequelize');
// new Sequelize query the osm database at port 5432 
// with username postgress and no password
var sequelize = new Sequelize('postgres://postgres@localhost:5432/osm');

// use handlebars to display views
app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', exphbs({
  defaultLayout: 'main',
  helpers: {
    section: function(name, options) {
      if (!this._sections) this. _sections = {};
      this._sections[name] = options.fn(this);
      return null;
    },
  },
}));
app.set('view engine', 'handlebars');
// main page
app.get('/', function(req, res) {
  res.render('map');
});

// get two GeoJSON coordinates as string from request body
// query the database, do the routing and return a route as GeoJSON
app.post('/getRoute', function(req, res) {
  // query content, currently a long string
  // will be nicer if this is stored in a file instead of hard coded
  var query = (
    'CREATE OR REPLACE FUNCTION getRoute(source integer, target integer) ' +
  '  RETURNS TABLE(seq integer, path_seq integer, node bigint, edge bigint, cost double precision, agg_cost double precision) AS $$ ' +
  '  SELECT d.seq, d.path_seq, d.node, d.edge, d.cost, d.agg_cost ' +
  '    FROM pgr_dijkstra(\'SELECT osm_id AS id, source, target, ' +
  'grade + ST_Length(geom) AS cost FROM routing_info WHERE grade IS NOT NULL\', $1, $2, false) AS d; ' +
  '$$ LANGUAGE sql; ' +
  'CREATE OR REPLACE FUNCTION getNearestNode (geom text) ' +
  'RETURNS integer AS $$ ' +
  '   SELECT CAST (id AS integer) FROM routing_info_vertices_pgr ORDER BY the_geom <-> ST_Transform(ST_GeometryFromText(ST_AsText(ST_GeomFromGeoJSON(geom)),4326), 900913) LIMIT 1; ' +
  '$$ LANGUAGE sql; ' +
  'SELECT ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geojson FROM routing_info WHERE osm_id IN (SELECT edge FROM getRoute(getNearestNode(?), getNearestNode(?)))');
  sequelize.query(query,
    {replacements: [req.body.source, req.body.target], type: sequelize.QueryTypes.SELECT}).then(function(results) {
    var edges = [];
    // loop through query result and add to the list
    for (i = 0; i < results.length; i++) {
      console.log(results[i]['geojson']);
      edges.push(results[i]['geojson']);
    }
    // return the list of edges (route)
    res.send(edges);
  });
});

// running on port 3000
app.listen(3000, function() {
  console.log('Example app listening on port 3000!');
});
