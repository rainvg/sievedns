var nativedns = require('native-dns');

function dns(port, ip)
{
  'use strict';

  // Settings

  var settings = {fallback: '8.8.8.8', timeout: 1000, ttl: 600};

  // Private methods

  var __complete__ = function(request)
  {
    var complete = true;
    request.question.forEach(function(q)
    {
      if(!q.answered)
        complete = false;
    });

    return complete;
  };

  // Constructor

  if(!(this instanceof dns))
    throw {code: 0, description: 'Constructor must be called with new.', url: ''};

  var self = this;

  var _server = nativedns.createServer();
  var _sieves = {A: [], AAAA: [], NS: [], CNAME: [], PTR: [], NAPTR: [], TXT: [], MX: [], SRV: [], SOA: []};

  var _fields = {
    A: {address: 'string'},
    AAAA: {address: 'string'},
    NS: {data: 'string'},
    CNAME: {data: 'string'},
    PTR: {data: 'string'},
    NAPTR: {order: 'number', preference: 'number', flags: 'string', service: 'string', regexp: 'string', replacement: 'string'},
    TXT: {data: ['string']},
    MX: {priority: 'number', exchange: 'string'},
    SRV: {priority: 'number', weight: 'number', port: 'number', target: 'string'},
    SOA: {primary: 'string', admin: 'string', serial: 'number', refresh: 'number', retry: 'number', expiration: 'number', minimum: 'number'}
  };

  if(typeof port !== 'number' ||  port % 1 !== 0 || port < 0 || port > 65535)
    throw {code: 1, description: 'Wrong port syntax', url: ''};

  if(!ip)
    ip = '0.0.0.0';

  _server.on('request', function(request, response)
  {
    console.log(request);
    
    request.question.forEach(function(question)
    {
      var type = nativedns.consts.QTYPE_TO_NAME[question.type];
      var sieved = false;

      _sieves[type].forEach(function(sieve)
      {
        if(sieve.regex.test(question.name))
        {
          sieved = true;

          sieve.callback(question.name, function(rows)
          {
            if(!(rows instanceof Array))
              rows = [rows];

            rows.forEach(function(row)
            {
              if(typeof row === 'string')
                row = {'A': {address: row}, 'AAAA': {address: row}, 'MX': {exchange: row}, 'NS': {data: row}, 'CNAME': {data: row}}[type];

              row.type = row.type || type;
              row.name = row.name || question.name;
              row.ttl = row.ttl || settings.ttl;

              for(var field in sieve.defaults)
                row[field] = row[field] || sieve.defaults[field];

              response.answer.push(nativedns[row.type](row));

              for(var field in _fields[row.type])
              {
                if(!(_fields[row.type][field] instanceof Array))
                {
                  if(typeof row[field] !== _fields[row.type][field])
                    throw {code: 2, description: 'Field malformed.', url: '', field: field};
                }
                else
                {
                  if(!(row[field] instanceof Array))
                    throw {code: 3, description: 'Array required.', url: '', field: field};

                  row[field].forEach(function(subfield) // jshint ignore: line
                  {
                    if(typeof subfield !== _fields[row.type][field][0])
                      throw {code: 4, description: 'Sub-field malformed.', url: '', field: field, subfield: subfield};
                  });
                }
              }
            });

            question.answered = true;

            if(__complete__(request))
              response.send();
          });
        }
      });

      if(!sieved)
      {
        var req = nativedns.Request({
          question: question,
          server: { address: settings.fallback, port: 53, type: 'udp' },
          timeout: settings.timeout
        });

        req.on('message', function (err, answer)
        {
          question.answered = true;

          answer.answer.forEach(function (a)
          {
            response.answer.push(a);
          });

          if(__complete__(request))
            response.send();
        });

        req.send();
      }
    });
  });

  _server.on('error', function(err)
  {
    console.log(err.stack);
  });

  // Methods

  self.sieve = function(type, regex, param1, param2)
  {
    var defaults = param2 ? param1 : {};
    var callback = param2 ? param2 : param1;

    _sieves[type].push({regex: regex, callback: callback, defaults: defaults});
  };

  self.serve = function()
  {
    _server.serve(port, ip);
  };
}

module.exports = {
  dns: dns
};
