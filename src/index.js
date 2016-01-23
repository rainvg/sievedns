var nativedns = require('native-dns');

function dns(port, ip)
{
  'use strict';
  var _server = nativedns.createServer();
  var _sieves = [];

  if(typeof port !== 'number' ||  port % 1 !== 0)
  {
    throw 'Wrong port syntax';
  }

  if(typeof ip === 'undefined')
    ip = '0.0.0.0';

  _server.on('request', function(request, response)
  {
    // Sieving
    _sieves.forEach(function(sieve)
    {
      if(!sieve.regex.test(request.question[0].name))
      {
        var _req = nativedns.Request({
          question: request.question[0],
          server: { address: '8.8.8.8', port: 53, type: 'udp' },
          timeout: 1000
        });

        _req.on('message', function (err, answer)
        {
          answer.answer.forEach(function (a)
          {
            response.answer.push(a);
          });

          response.send();
        });

        _req.send();
      }
      else
      {
        sieve.callback(request.question[0].name, function(ip)
        {
          response.answer.push(nativedns.A({
            name: request.question[0].name,
            address: ip,
            ttl: sieve.ttl,
          }));

          response.send();
        });
      }
    });
  });

  _server.on('error', function(err)
  {
    console.log(err.stack);
  });

  // jshint ignore: start
  var __sieve__ = this.sieve = function(regex, callback, ttl)
  {
    if(typeof ttl === 'undefined')
      ttl = 600;

    _sieves.push({'regex': regex, 'callback': callback, 'ttl': ttl});
  };

  var __serve__ = this.serve = function()
  {
    _server.serve(port, ip);
  };
  // jshint ignore: end
}

module.exports = {
  dns: dns
};
