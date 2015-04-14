'use strict';

require(['bower_components/threads/threads'], function(threads) {
  threads.manager({
    'latency-service': {
      src: 'js/services/latency.js',
      type: 'worker'
    }
  });

  const ITERATIONS = 100;

  var app = {
    client: threads.client('latency-service'),
    rawWorker: new Worker('js/workers/latency.js'),
    channel: 'BroadcastChannel' in window ? new BroadcastChannel('latency') : {},

    elements: {
      reload: document.getElementById('reload'),
      results: document.getElementById('results')
    },

    firstRun: true,

    init: function() {
      this.rawWorker.postMessage(0);
      this.rawWorker.onmessage = () => {
        // The web worker is ready.
        this.rawWorker.onmessage = null;

        setTimeout(() => {
          this.startMeasuring();
        }, 500);
      };

      this.elements.reload.addEventListener('click', () => {
        this.startMeasuring();
      });

    },

    startMeasuring: function() {
      this.elements.results.innerHTML = '';

      this.firstRun = true;
      this.measureLatencyOfThreads([]);
      this.measureLatencyOfWebWorkersWithPostMessage([]);
      this.measureLatencyOfWebWorkersWithBroadcastChannel([]);
    },

    measureLatencyOfThreads: function(values) {
      var now = Date.now();
      var highResolutionBefore = performance.now();

      this.client
        .call('ping', now)
        .then(timestamps => {
          var now = Date.now();
          var highResolutionAfter = performance.now();
          var value = [
            timestamps[0],
            now - timestamps[1],
            highResolutionAfter - highResolutionBefore
          ];

          if (!this.firstRun) {
            // We don't keep the first measure that's too erratic.
            values.push(value);
          }

          if (values.length < ITERATIONS) {
            this.measureLatencyOfThreads(values);
          } else {
            this.processData('threads library', values);
          }

          this.firstRun = false;
        });
    },

    measureLatencyOfWebWorkersWithPostMessage: function(values) {
      var now = Date.now();
      var highResolutionBefore = performance.now();

      this.rawWorker.postMessage(now);
      this.rawWorker.onmessage = evt => {
        var timestamps = evt.data;
        var now = Date.now();
        var highResolutionAfter = performance.now();
        var value = [
          timestamps[0],
          now - timestamps[1],
          highResolutionAfter - highResolutionBefore
        ];

        values.push(value);

        if (values.length < ITERATIONS) {
          this.measureLatencyOfWebWorkersWithPostMessage(values);
        } else {
          this.processData('Web Workers with postMessage', values);
        }
      };
    },

    measureLatencyOfWebWorkersWithBroadcastChannel: function(values) {
      if (!BroadcastChannel) {
        // Not all browsers implement the BroadcastChannel API.
        return;
      }

      var now = Date.now();
      var highResolutionBefore = performance.now();

      this.channel.postMessage(now);
      this.channel.onmessage = evt => {
        var timestamps = evt.data;
        var now = Date.now();
        var highResolutionAfter = performance.now();
        var value = [
          timestamps[0],
          now - timestamps[1],
          highResolutionAfter - highResolutionBefore
        ];

        values.push(value);

        if (values.length < ITERATIONS) {
          this.measureLatencyOfWebWorkersWithBroadcastChannel(values);
        } else {
          this.processData('Web Workers with Broadcast Channel', values);
        }
      };
    },

    processData: function(title, values) {
      var uploadVal = values.map(value => value[0]);
      var downloadVal = values.map(value => value[1]);
      var roundtripVal = values.map(value => value[2]);

      var uploadMean = mean(uploadVal).toFixed(3);
      var downloadMean = mean(downloadVal).toFixed(3);
      var roundtripMean = mean(roundtripVal).toFixed(3);
      var uploadMedian = median(uploadVal).toFixed(3);
      var downloadMedian = median(downloadVal).toFixed(3);
      var roundtripMedian = median(roundtripVal).toFixed(3);
      var uploadStdev = stdev(uploadVal).toFixed(3);
      var downloadStdev = stdev(downloadVal).toFixed(3);
      var roundtripStdev = stdev(roundtripVal).toFixed(3);
      var uploadPercentile = percentile(uploadVal, .85).toFixed(3);
      var downloadPercentile = percentile(downloadVal, .85).toFixed(3);
      var roundtripPercentile = percentile(roundtripVal, .85).toFixed(3);

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
          <tr>
            <th>RT</th>
            <td>${roundtripMean}ms</td>
            <td>${roundtripMedian}ms</td>
            <td>${roundtripStdev}</td>
            <td>${roundtripPercentile}</td>
          </tr>
        </table>
      `;

      var container = document.createElement('div');
      container.innerHTML = tpl;
      this.elements.results.appendChild(container);
    }
  };

  app.init();
});
