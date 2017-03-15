# AccessMapLite
This is a simplized version of AccessMap that only uses slope information for routing.

# Tutorial
This tutorial is based on Mac OS X so the installation process might be different if you are using another platform.
## Setup the Database
This section explains how to download Washington openstreetmap data and create a PostGIS-enabled postgres database with it:
### Step 1: Download washington-latest.osm.pbf
Download the Washington openstreetmap file [here](http://download.geofabrik.de/north-america/us/washington.html)
### Step 2: Installing PostgreSQL/PostGIS with homebrew
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
### Step 3: Set up a database for your OSM data
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
 ### Step 4: Install osm2pgsql
There are several ways to install osm2pgsql that will not affect its integration with others. 

Choice 1:
I downloaded this installer [here](http://cl.ly/0j0E0N1J3z0z) and installed osm2pgsql, but it will probably be outdated.
After installation you’ll want to make sure that the osm2pgsql command is available without having to type the full path to where you installed it. If just typing osm2pgsql in a terminal gives the error -bash: osm2pgsql: command not found then you can run these commands in the Terminal:
```
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile
 ```
Choice 2:
Install with brew as well
```
brew install osm2pgsql
```

 ### Step 5: Load data into your database:
With a PBF file downloaded, you can import it with osm2pgsql. Assuming you downloaded the PBF to your Downloads folder, run the following command in the Terminal (making sure to replace your_file.osm.pbf with the actual name of your file):
 ```
osm2pgsql -cGs -d osm -S /usr/local/share/osm2pgsql/default.style ~/Downloads/your_file.osm.pbf
```
NOTE: In this tutorial I am using the installer (Choice 1 in last step) so if default.style is not found in the given path you need to use 
`which osm2pgsql` to locate your version of osm2pgsql and replace
 `/usr/local/share/osm2pgsql/default.style` with the correct path
 
 ### Step 6: Test query!
 In your command line, log into osm database by
 ```psql osm```
 and do a test query:
```SELECT * FROM ways LIMIT 2;```
SELECT * FROM planet_osm_ways LIMIT 2;
## References
[Tutorial: creating postgres database with osm data](https://tilemill-project.github.io/tilemill/docs/guides/osm-bright-mac-quickstart/)

