var https = require('https');
var fs = require('fs');
var path = require('path');
var qs = require('querystring');

var options = {
  key: fs.readFileSync(path.resolve(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, 'key-cert.pem'))
};

var port = 13002;
var handler = null;
var server = https.createServer(options, function(request, response) {
  var body = [];
  request.on('data', function(data) {
    body.push(data);
  });
  request.on('end', function () {
    response.writeHead(200);
    response.end('OK');
    handler && handler({
      url: request.url,
      body: JSON.parse(body.join(''))
    });
  });
});

module.exports = {
  listening: false,
  port: port,
  on: function(callback, setHandler) {
    var port = this.port;
    handler = setHandler;
    if (!this.listening) {
      this.listening = true
      server.listen(port, () => {
        console.log('LISTENING TO PORT: %s', port);
        callback();
      });
    } else {
      callback();
    }
    return this;
  }
};
