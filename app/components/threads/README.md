## threads

Exposes services from one 'thread' to another.

A 'thread' could be an instance of:

- `Window` (inc. iframe)
- `Worker`
- `SharedWorker`

### Service

A `Service` is a collection of methods exposed to a `Client`. Methods can be sync or async (using `Promise`s).

```js
importScripts('threads.js');

threads.service('my-service', {
  myMethod: function(param) {
    return 'hello: ' + param;
  },

  myOtherMethod: function() {
    return new Promise(resolve => {
      setTimeout(() => resolve('result'), 1000);
    });
  }
});
```

### Client

`Service`s are digested by `Client`s.

```js
var threads = require('threads');
var client = threads.client('my-service');

client.call('myMethod', 'world').then(value => {
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

### Bypassing the Manager



### Memory management

Threads keep track of how many inbound clients are connected to them. When the last client disconnects they will broadcast a `'redundant'` event. Whatever spawned the thread (usually the Manager) can then destroy it to free up memory.

To manage memory in you apps you can `.disconnect()` clients when the app is in the background and re`.connect() when they come back to the foreground.

### Open questions

- How should versioning of Services work?
- When `type: 'window'` should we do the job of loading this in a `.html` document, or is it best to leave this to the user.
- Workers use `importScripts()` and window `<script>`, what is a sensible format that would allow authoring script that will run in either environment type?
