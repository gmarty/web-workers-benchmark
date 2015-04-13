'use strict';

require(['bower_components/threads/threads'], function(threads) {
  threads.manager({
    'latency-service': {
      src: 'js/services/latency.js',
      type: 'worker'
    }
  });

  const ITERATIONS = 100;

  var client = threads.client('latency-service');
  var rawWorker = new Worker('js/workers/latency.js');
  var channel = 'BroadcastChannel' in window ? new BroadcastChannel('latency') : {};
  var main = document.getElementById('main');

  var firstRun = true;

  rawWorker.postMessage(0);
  rawWorker.onmessage = function start() {
    // The web worker is ready.
    rawWorker.onmessage = null;

    setTimeout(function() {
      measureLatencyOfThreads([]);
      measureLatencyOfWebWorkersWithPostMessage([]);
      measureLatencyOfWebWorkersWithBroadcastChannel([]);
    }, 500);
  };

  function measureLatencyOfThreads(values) {
    var now = Date.now();

    client
      .call('ping', now)
      .then(function(timestamps) {
        var now = Date.now();
        var value = [timestamps[0], now - timestamps[1]];

        if (!firstRun) {
          // We don't keep the first measure that's too erratic.
          values.push(value);
        }

        if (values.length < ITERATIONS) {
          measureLatencyOfThreads(values);
        } else {
          processData('threads library', values);
        }

        firstRun = false;
      });
  }

  function measureLatencyOfWebWorkersWithPostMessage(values) {
    var now = Date.now();

    rawWorker.postMessage(now);
    rawWorker.onmessage = function(evt) {
      var timestamps = evt.data;
      var now = Date.now();
      var value = [timestamps[0], now - timestamps[1]];

      values.push(value);

      if (values.length < ITERATIONS) {
        measureLatencyOfWebWorkersWithPostMessage(values);
      } else {
        processData('Web Workers with postMessage', values);
      }
    };
  }

  function measureLatencyOfWebWorkersWithBroadcastChannel(values) {
    if (!BroadcastChannel) {
      // Not all browsers implement the BroadcastChannel API.
      return;
    }

    var now = Date.now();

    channel.postMessage(now);
    channel.onmessage = function(evt) {
      var timestamps = evt.data;
      var now = Date.now();
      var value = [timestamps[0], now - timestamps[1]];

      values.push(value);

      if (values.length < ITERATIONS) {
        measureLatencyOfWebWorkersWithBroadcastChannel(values);
      } else {
        processData('Web Workers with Broadcast Channel', values);
      }
    };
  }

  function processData(title, values) {
    var uploadVal = values.map(function(measure) {
      return measure[0];
    });
    var downloadVal = values.map(function(measure) {
      return measure[1];
    });

    var uploadMean = mean(uploadVal);
    var downloadMean = mean(downloadVal);
    var uploadMedian = median(uploadVal);
    var downloadMedian = median(downloadVal);
    var uploadStdev = stdev(uploadVal).toFixed(3);
    var downloadStdev = stdev(downloadVal).toFixed(3);
    var uploadPercentile = percentile(uploadVal, .85);
    var downloadPercentile = percentile(downloadVal, .85);

    var tpl = `
      <header>
        <h2>${title}</h2>
      </header>
      <table>
        <tr>
          <th></th>
          <th>Mean</th>
          <th>Median</th>
          <th>Std dev</th>
          <th>85th percentile</th>
        </tr>
        <tr>
          <th>U</th>
          <td>${uploadMean}ms</td>
          <td>${uploadMedian}ms</td>
          <td>${uploadStdev}</td>
          <td>${uploadPercentile}</td>
        </tr>
        <tr>
          <th>D</th>
          <td>${downloadMean}ms</td>
          <td>${downloadMedian}ms</td>
          <td>${downloadStdev}</td>
          <td>${downloadPercentile}</td>
        </tr>
      </table>`;

    var container = document.createElement('div');
    container.innerHTML = tpl;
    main.appendChild(container);
  }
});
