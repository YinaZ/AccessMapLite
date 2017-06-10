var express = require('express'),
    path = require('path'),
    logger = require('morgan');

var index = require('./routes/index');
var tiles = require('./routes/tiles');
var api = require('./routes/api');

var app = express();
var env = process.env.NODE_ENV || 'development';

app.use(logger('dev'));
app.use(express.static('public'))

app.use('/', index);
app.use('/tiles', tiles);
app.use('/api', api);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
