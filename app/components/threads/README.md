# threads [![](https://travis-ci.org/gaia-components/threads.svg)](https://travis-ci.org/gaia-components/threads) [![devDependency Status](https://david-dm.org/gaia-components/threads/dev-status.svg)](https://david-dm.org/gaia-components/threads#info=devDependencies)

Exposes services from one 'thread' to another.

A 'thread' could be an instance of:

- `Window` (inc. iframe)
- `Worker`
- `SharedWorker`

### Service

A `Service` is a collection of methods exposed to a `Client`. Methods can be sync or async (using `Promise`s).

```js
importScripts('threads.js');

threads.service('my-service')
  .method('myMethod', function(param) {
    return 'hello: ' + param;
  })
  .method('myOtherMethod', function() {
    return new Promise(resolve => {
      setTimeout(() => resolve('result'), 1000);
    });
  });
```

### Client

`Service`s are digested by `Client`s.

```js
var threads = require('threads');
var client = threads.client('my-service');

client.method('myMethod', 'world').then(value => {
  console.log(value); //=> 'hello: world'
});
```

### Manager

The `Manager` acts as a middleman between the `Client` and the `Service`. It listens for newly created clients and will attempt to pair it to a known service. If the requested service isn't running it will spin one up.

```js
threads.manager({
  'my-service': {
    src: '/workers/my-service.js',
    type: 'worker'
  }
});
```

### Events

Events can be fired from a `Service`, these will trigger any subscribed callbacks on the client-side.

```js
var service = threads.service('my-service');
var count = 0;

setInterval(() => {
  service.broadcast('tick', ++count);
}, 1000);
```

```js
var client = threads.client('my-service');
client.on('tick', count => console.log('tick', count));
```

### Contracts

Contracts can be used to enforce a strict, well defined protocol between `Service` and `Client`. A `contract` object accepts two keys: `methods` and `events`. Each object defines an event/method name and the expected arguments.

```js
threads.manager({
  'my-service': {
    src: '/workers/my-service.js',
    type: 'worker',
    contract: {
      methods: {
        myMethod: ['string']
      },

      events: {
        tick: 'number'
      }
    }
  }
});
```

### Streams

Some services need to send data in *chunks* to the clients and also allow
a way of canceling the action before it is completed. For these cases register
the action as a `stream()`:

```js
threads.service('my-service')
  .stream('myStreamingMethod', function(stream, param) {
    if (param === 'foo') {
      stream.write('bar');
    }

    if (param === 'dolor') {
      // abort() is the way to signal to client that action failed
      stream.abort(new TypeError('invalid argument "dolor"'));
      return;
    }

    var timeout = setTimeout(function() {
      stream.write('baz');
      // close() signals that action finished with success
      stream.close();
    }, 10);

    // you should implement the `cancel` method on the `stream` if your service
    // supports cancellation
    stream.cancel = function(reason) {
      clearTimeout(timeout);
      // you can return a promise if cancel is async; or omit return if action
      // is synchronous or you don't want to notify the client about completion
    };
  });
```

```js
var client = threads.client('my-service');
var stream = client.stream('myStreamingMethod', 'foo');

// called every time the service sends some data
stream.listen(function(data) {
  console.log('data:', data);
});

// "closed" is a Promise that will be fullfilled when stream is closed with
// success or rejected when the service "abort" the operation
stream.closed.then(onStreamClose, onStreamAbort);

// important to note that not all services are able to handle cancellation
// in those cases the promise will be rejected
stream.cancel('because I want').then(onCancelSuccess, onCancelError);
```

PS: The streaming implementation is very basic and doesn't handle
*backpressure*, buffering and piping; it is just a simple event bridge between
the `service` and the `client`. This was done on purpose to avoid complexity.
The methods `close()`, `abort()` and `write()` return Promises that can be used
to validate if action was executed (eg. `write` have no effect after `close` so
promise will be rejected).


### Bypassing the Manager



### Memory management

Threads keep track of how many inbound clients are connected to them. When the last client disconnects they will broadcast a `'redundant'` event. Whatever spawned the thread (usually the Manager) can then destroy it to free up memory.

To manage memory in you apps you can `.disconnect()` clients when the app is in the background and re`.connect() when they come back to the foreground.

### Versioning services

Right now the best way to version a service is include a version in the service name.

```js
threads.service('my-service@v0.1.0', ...);
```

```js
threads.client('my-service@v0.1.0');
```

### Open questions

- When `type: 'window'` should we do the job of loading this in a `.html` document, or is it best to leave this to the user.

- Workers use `importScripts()` and window `<script>`, what is a sensible format that would allow authoring script that will run in either environment type?

- With `BroadcastChannel` it's possible for a `Worker` to have a client from another browser 'tab'. This is dangerous as if 'tab1' is closed, any clients in 'tab2' that depend on services in 'tab1' will be disconnected. This could be fixed by ensuring only `SharedWorkers` can used for cross-tab services and that each tab's manager calls `new SharedWorker(...)`.
