var express = require('express')

var exphbs = require('express-handlebars')
var app = express()
var path = require('path')
var bodyParser = require("body-parser");

var Sequelize = require('sequelize');
var sequelize = new Sequelize('postgres://postgres@localhost:5432/osm');

app.use(bodyParser.json());

app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', exphbs({
  defaultLayout: 'main',
  helpers: {
    section: function(name, options) {
      if(!this._sections) this. _sections = {};
      this._sections[name] = options.fn(this);
      return null
    }
  }
}));
app.set('view engine', 'handlebars');
app.get('/', function (req, res) {
  res.render('map')
})

app.post('/getRoute', function (req, res) {
  var query = ('CREATE OR REPLACE FUNCTION _a_route(source integer, target integer) '
  + 'RETURNS TABLE(seq integer, path_seq integer, node bigint, edge bigint, cost double precision, agg_cost double precision) AS $$ '
  + '  SELECT d.seq, d.path_seq, d.node, d.edge, d.cost, d.agg_cost '
  + '    FROM pgr_dijkstra(\'SELECT osm_id AS id, source, target, '
  + 'grade + ST_Length(geom) AS cost FROM routing_info WHERE grade IS NOT NULL\', $1, $2, false) AS d; '
  + '$$ LANGUAGE sql; '
  + 'CREATE OR REPLACE FUNCTION getNearestNode (geom text) '
  + 'RETURNS integer AS $$ '
  + '   SELECT CAST (id AS integer) FROM routing_info_vertices_pgr ORDER BY the_geom <-> ST_Transform(ST_GeometryFromText(ST_AsText(ST_GeomFromGeoJSON(geom)),4326), 900913) LIMIT 1; '
  + '$$ LANGUAGE sql; '
  + 'SELECT ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geojson FROM routing_info WHERE osm_id IN (SELECT edge FROM _a_route(getNearestNode(?), getNearestNode(?)))')
  sequelize.query(query, 
    { replacements: [req.body.source, req.body.target], type: sequelize.QueryTypes.SELECT }).then(function(results) {
    var edges = []
    for (i = 0; i < results.length; i++) {
      console.log(results[i]['geojson'])
      edges.push(results[i]['geojson'])
    }
    res.send(edges)
  })
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
