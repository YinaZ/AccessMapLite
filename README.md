# AccessMapLite
This is a simplized version of AccessMap that only uses slope information for routing.
# What to do next
There are still issues in [GitHub Issues](https://github.com/YinaZ/AccessMapLite/issues) that need to be solved. 

Besides the existing issues, there are also two main tasks to do in the future. 
1) Smooth the elevation data. Currently the elevation data is calculated with (elevations of start point - elevation of end point) / edge length), which is not optimal because the elevation of a certain point can be extremely high if there is a building at that point. 
2) Integration (such as integrating current front end code with AccessMap front end code, so that the code can be more reusable)
# Tutorial
This tutorial is based on Mac OS X so the installation process might be different if you are using another platform.
## Part 1: Setup the Database
This section explains how to download Washington openstreetmap data and create a PostGIS-enabled postgres database with it:
### Step 1: Installing PostgreSQL/PostGIS with homebrew
First make sure your homebrew install is up to date:
```
brew update
```
Then install postgis like:
```
brew install postgis
```
After installation you’ll need to override the OS X system ‘psql’ command with the new version you just installed. Run this in the Terminal:
```
alias psql=/usr/local/opt/postgresql/bin/psql
```
To make this alias persistent across Terminal sessions you should include it in your .bash_profile by running this command:
```
echo "alias psql=/usr/local/opt/postgresql/bin/psql" >> ~/.bash_profile
```
### Step 2: Set up a database for your OSM data
First open a PostgreSQL:
```
psql -U postgres
```
Run these commands:
 ```
create database osm;
\connect osm
create extension postgis;
\quit
 ```
 ### Step 3: Install osm2pgsql
Install with brew as well
```
brew install osm2pgsql
```
After installation you’ll want to make sure that the osm2pgsql command is available without having to type the full path to where you installed it. If just typing osm2pgsql in a terminal gives the error -bash: osm2pgsql: command not found then you can run these commands in the Terminal:
```
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile
 ```

 ### Step 4: Load data into your database with osm2pgsql:
Download the Washington openstreetmap file washington-latest.osm.pbf [here](http://download.geofabrik.de/north-america/us/washington.html)

With a pbf file downloaded, you can import it with osm2pgsql. Assuming you downloaded the PBF to your Downloads folder, run the following command in the Terminal:
 ```
osm2pgsql -cGs -d osm -S /usr/local/share/osm2pgsql/default.style ~/Downloads/washington-latest.osm.pbf
```
NOTE: In this tutorial I am using the installer (Choice 1 in last step) so if default.style is not found in the given path you need to use 
`which osm2pgsql` to locate your version of osm2pgsql and replace
 `/usr/local/share/osm2pgsql/default.style` with the correct path
 
 After loading the data, in your command line log into osm database by
 ```
 psql osm
 ```
 and do a test query:
 ```
SELECT * FROM planet_osm_ways LIMIT 2;
```
### Step 5: Install pgRouting, create your own routing info table and actually do a routing!
First install pgRouting with brew:
```
brew install pgrouting
```
Here let's create a table that contains information needed for routing with pgRouting:

Use `psql osm` to log into your osm database, and then use these commands to create the pgrouting extension and then create a table named routing_info
```
CREATE EXTENSION pgrouting;
CREATE TABLE routing_info AS SELECT way AS geom, osm_id FROM planet_osm_roads;
ALTER TABLE routing_info ADD COLUMN source integer;
ALTER TABLE routing_info ADD COLUMN target integer;
```
Now let's create topology with pgrouting:
```
select pgr_createTopology('routing_info', 0.000001, 'geom', 'osm_id');
```
The above line should also have created a vertices table: `<edge_table>_vertices_pgr`, so if the table is named `routing info` the vertices table is named `routing_info_vertices_pgr`
Now check if graph has errors:
```
select pgr_analyzegraph('routing_info', 0.000001, 'geom', 'osm_id');
```
If everything went fine, let's try a dijkstra:
```
select pgr_dijkstra('SELECT osm_id AS id, source, target, ST_Length(geom) AS cost FROM routing_info', 31, 9);
```
Notice that currently the dijkstra is routing based on distance instead of elevation and we want to eventually use elevation as weights
### Step 6: Load elevation data into database
Good job on coming so far! Now let's load the elevation data into the database as well!

1) Download and unzip the elevation data (raster data) [here](https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/ArcGrid/n48w123.zip)

Import using rast2pgsql, which should have been installed along with PostGIS (make sure it's both installed and enabled on your specific database)

 2) Under the directory that contains w001001.adf, turn it into SQL file: raster2pgsql -d -t 64x64 w001001.adf dem.seattle > "n48w123.seattle.sql"
 
 3) Run the SQL on the database: 
```
psql -d osm -c "CREATE SCHEMA IF NOT EXISTS dem;"
psql -d osm -f n48w123.seattle.sql 1> /dev/null
```
Notes:
* You'll probably need to add the connection info to the psql commands (host, database, user, password, etc)
* All of the paths (.adf and .sql) may need to be modified depending on the location of your files
* The elevation data may expand quite a bit in the database and take up several GB

Now log into osm database and try a query on dem.seattle:
```
SELECT * FROM dem.seattle LIMIT 1;
```
To speed up queries on dem.seattle, create index:
```
CREATE INDEX seattle_convexhull_index
          ON dem.seattle
       USING gist(ST_ConvexHull(rast));
```
### Step 7: Add elevation data into your table!
Now log into osm database and do these commands to add elevation data into your table:
```
ALTER TABLE routing_info ADD COLUMN grade NUMERIC(6, 4);
ALTER TABLE routing_info ADD COLUMN ele_start NUMERIC(10, 1);
ALTER TABLE routing_info ADD COLUMN ele_end NUMERIC(10, 1);

CREATE TEMPORARY TABLE endpoints AS
    SELECT  r.osm_id,
            ST_Transform(ST_StartPoint(r.geom), n.srid) AS startpoint,
            ST_Transform(ST_EndPoint(r.geom), n.srid) AS endpoint
    FROM routing_info r,
         (SELECT ST_SRID(rast) AS srid
            FROM dem.seattle
           LIMIT 1) n;

UPDATE routing_info r
   SET ele_start = ST_Value(n.rast, e.startpoint)
  FROM dem.seattle n,
       endpoints e
 WHERE ST_Intersects(n.rast, e.startpoint)
   AND r.osm_id = e.osm_id;

UPDATE routing_info r
   SET ele_end = ST_Value(n.rast, e.endpoint)
  FROM dem.seattle n,
       endpoints e
 WHERE ST_Intersects(n.rast, e.endpoint)
   AND r.osm_id = e.osm_id;

UPDATE routing_info
   SET grade = (ele_end - ele_start) / ST_Length(geom);
```
Basically the above block of commands finds the elevation of start and end points of an edge, and divide their difference by the length of the edge, to get the grade, which is the slope of the road. 

Congratulations on setting up the database! Now you can run the app!

## Part 2: Run the app!
### Step 1: Install dependencies
Under AccessMapLite directory, install the dependencies:
```
npm install
```
The above line should help you install all the things you need, but if you get error complaining that something
is still not there, you can manually install like this:
```
npm install <dependency name>
```
### Step 2: Run the app!
 You can now run app.js under AccessMapLite directory:
```
node app.js
```
Open your browser and check out `http://localhost:3000/`
## Part 3: Run the webpack-integration branch
 webpack-integration branch currently can load tiles from routing_info table and display on the map. Routing function is not added yet.
 ### Step 1: Install dependencies
Under AccessMapLite directory, install the dependencies:
```
npm install
```
The above line should help you install all the things you need, but if you get error complaining that something
is still not there, you can manually install like this:
```
npm install <dependency name>
```
 ### Step 2: Get accessmap-vt
 We need accessmap-vt to provide vector tiles for AccessMapLite. I forked accessmap-vt [here](https://github.com/YinaZ/accessmap-vt) and changed the code to work for AccessMapLite. 
 To get accessmap-vt, please do
 ```
 git clone git@github.com:YinaZ/accessmap-vt.git
 ```
 Make sure you are using the correct node version:
 ```
 nvm use
 ```
 Then do `npm install` or `yarn` to install all the dependencies. (When I tried`npm install` and run the app, it throws error and complains about the version of certain dependencies, so I did `yarn` instead and everything worked fine. If you ended up having such errors please definitely try installing yarn.
 ### Step 3: Install Docker
 accessmap-vt needs Docker installed.
 
 Download Docker[here](https://docs.docker.com/engine/installation/) and install it.
 ### Step 4: Source set_envs.sh
 You need to source set_envs.sh in both AccessMapLite and accessmap-vt.
 In both directories you can find set_envs.sh.example, copy set_envs.sh.example, rename to set_envs.sh and modify it according to your database:
 ```
 cp set_envs.sh.example set_envs.sh
 ```
 Edit set_envs.sh to be something similar to this:
 ```
 export DATABASE_URL=postgresql://postgres:@localhost:5432/osm
 ```
 And in both directories do
 ```
 source set_envs.sh
 ```
 ### Step 5: Run accessmap-vt
 Run the app under accessmap-vt directory:
 ```
 npm run app
 ```
 Wait for several minutes till the console output says `routing tiles built...`
 
 ### Step 6: Run AccessMapLite
 Now run the app under AccessMapLite directory:
 ```
 npm run app
 ```
 Open your browser and check out `http://localhost:3000/`
 
## References
[Tutorial: creating postgres database with osm data](https://tilemill-project.github.io/tilemill/docs/guides/osm-bright-mac-quickstart/)

[accessmap-database-bootup](https://github.com/AccessMap/accessmap-database-bootup/tree/master/data_manager/sql)
