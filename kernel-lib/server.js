var http = require('http'),
    https = require('https'),
    util = require('util'),
    fs = require('fs'),
    path = require('path'),
    util = require('util'),
    url = require('url'),
    static = require('node-static'),
    events = require('events'),
    nodeCleanup = require('node-cleanup'),
    httpAuth = require('http-auth');


exports.createServer = function (paths, options) {
    return new Server(paths, options);
};


function Server (paths, config) {
    var me = this,
        options = config.server;

    // call events constructor
    events.EventEmitter.call(me);

    // initialize options and apply defaults
    me.paths = paths || {};
    me.options = options || {};
    me.options.host = me.options.host || '0.0.0.0';
    me.options.port = me.options.port || 9083;
    me.options.sslKey = me.options.sslKey || null;
    me.options.sslCert = me.options.sslCert || null;
    me.options.staticDir = me.options.staticDir || path.resolve(__dirname, '../kernel-www');
    me.options.socketPath = 'socketPath' in me.options ? me.options.socketPath : '/emergence/kernel.sock';

    // initialize state
    nodeCleanup(this.close.bind(this));
};

util.inherits(Server, events.EventEmitter);


Server.prototype.start = function () {
    // create authenticator
    const basicAuth = httpAuth.basic({
        realm: 'Emergence Node Management',
        file: '/emergence/admins.htpasswd'
    });

    // create static fileserver
    this.fileServer = new static.Server(this.options.staticDir);

    // listen on web port
    if (this.options.sslKey && this.options.sslCert) {
        this.webServer = https.createServer({
            key: fs.readFileSync(this.options.sslKey),
            cert: fs.readFileSync(this.options.sslCert)
        }, this.handleWebRequest.bind(this)).listen(this.options.port, this.options.host);

        this.webProtocol = 'https';
    } else {
        this.webServer = http.createServer(basicAuth, this.handleRequest.bind(this)).listen(this.options.port, this.options.host);

        this.webProtocol = 'http';
    }

    // listen on unix socket
    if (this.options.socketPath) {
        this.socketServer = http.createServer(this.handleRequest.bind(this)).listen(this.options.socketPath);
        fs.chmodSync(this.options.socketPath, '400');
    }

    console.log('Management server listening on '+this.webProtocol+'://'+this.options.host+':'+this.options.port);
};

Server.prototype.handleRequest = function (request, response) {
    var me = this;

    request.content = '';

    request.addListener('data', function (chunk) {
        request.content += chunk;
    });

    request.addListener('end', function () {
        request.urlInfo = url.parse(request.url);
        request.path = request.urlInfo.pathname.substr(1).split('/');
        console.log(request.method+' '+request.url);

        if (request.path[0] == 'server-config') {
            response.writeHead(200, {'Content-Type':'application/json'});
            response.end(JSON.stringify(me.options));
            return;
        }

        if (request.path[0] == 'package-info') {
            response.writeHead(200, {'Content-Type':'application/json'});
            response.end(JSON.stringify(require('../package.json')));
            return;
        }

        if (me.paths.hasOwnProperty(request.path[0])) {
            var result = me.paths[request.path[0]].handleRequest(request, response, me);

            if (result===false)  {
                response.writeHead(404);
                response.end();
            } else if (result !== true) {
                response.writeHead(200, {'Content-Type':'application/json'});
                response.end(JSON.stringify(result));
            }
        } else {
            me.fileServer.serve(request, response);
        }
    });
};

Server.prototype.close = function () {
    console.log('Shutting down management server...');

    if (this.webServer) {
        this.webServer.close();
    }

    if (this.socketServer) {
        this.socketServer.close();
    }
};
