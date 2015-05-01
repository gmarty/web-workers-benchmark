/* global threads */

/* Benchmark the latency of Web workers. */

import { Controller } from 'components/fxos-mvc/dist/mvc';

import LatencyView from 'js/views/latency';

import * as threads from 'components/threads/threads';

const ITERATIONS = 100;
const BROADCAST_CHANNEL_SUPPORT = 'BroadcastChannel' in window;

export default class LatencyController extends Controller {
  constructor(options) {
    this.view = new LatencyView({
      el: document.getElementById('latency')
    });
    super(options);
  }

  main() {
    this.view.setActive(true);

    var threadClient = null;
    if (BROADCAST_CHANNEL_SUPPORT) {
      threads.manager({
        'latency-service': {
          src: 'workers/latency-service.js',
          type: 'worker'
        }
      });

      threadClient = threads.client('latency-service');
    }

    this.client = threadClient;
    this.rawWorker = new Worker('workers/latency-worker.js');
    this.channel = BROADCAST_CHANNEL_SUPPORT ? new window.BroadcastChannel('latency') : {};

    // Start benchmarking.
    this.init();
  }

  teardown() {
    if (BROADCAST_CHANNEL_SUPPORT) {
      this.client.disconnect();
    }
    this.rawWorker.terminate();

    this.view.setActive(false);
  }

  init() {
    this.rawWorker.postMessage(0);
    this.rawWorker.onmessage = () => {
      // The web worker is ready.
      this.rawWorker.onmessage = null;

      this.startMeasuring();
    };
  }

  setActiveController(controllerName = 'home') {
    this.mainController.setActiveController(controllerName);
  }

  startMeasuring() {
    this.view.setLoader(true);

    this.view.initTable();
    this.view.initBarChart();
    this.view.initScatterPlot();

    var dataSets = [];

    this.measureLatencyOfWebWorkersWithPostMessage()
      .then((dataSet) => {
        if (dataSet) {
          dataSets.push(dataSet);
        }

        return this.measureLatencyOfWebWorkersWithBroadcastChannel();
      })
      .then((dataSet) => {
        if (dataSet) {
          dataSets.push(dataSet);
        }

        return this.measureLatencyOfThreads();
      })
      .then((dataSet) => {
        if (dataSet) {
          dataSets.push(dataSet);
        }

        this.view.processData(dataSets);
        this.view.setLoader(false);
      })
      .catch(error => {
        console.log(error);
      });
  }

  measureLatencyOfThreads() {
    return new Promise(resolve => {
      if (!BROADCAST_CHANNEL_SUPPORT) {
        console.error('The BroadcastChannel API is not supported.');
        resolve(null);
        return;
      }

      var dataSet = [];
      var benchmark = () => {
        var now = Date.now();
        var highResolutionBefore = window.performance.now();

        this.client
          .method('ping', now)
          .then(timestamps => {
            var now = Date.now();
            var highResolutionAfter = window.performance.now();
            var data = [
              timestamps[0],
              now - timestamps[1],
              highResolutionAfter - highResolutionBefore
            ];

            dataSet.push(data);

            if (dataSet.length <= ITERATIONS) {
              benchmark(dataSet);
            } else {
              resolve({
                name: 'threads library',
                shortName: 'threads',
                values: dataSet
              });
            }
          });
      };

      benchmark();
    });
  }

  measureLatencyOfWebWorkersWithPostMessage() {
    return new Promise(resolve => {
      var dataSet = [];
      var benchmark = () => {
        var now = Date.now();
        var highResolutionBefore = window.performance.now();

        this.rawWorker.postMessage(now);
        this.rawWorker.onmessage = evt => {
          var timestamps = evt.data;
          var now = Date.now();
          var highResolutionAfter = window.performance.now();
          var data = [
            timestamps[0],
            now - timestamps[1],
            highResolutionAfter - highResolutionBefore
          ];

          dataSet.push(data);

          if (dataSet.length <= ITERATIONS) {
            benchmark(dataSet);
          } else {
            resolve({
              name: 'Web Workers with postMessage',
              shortName: 'postMessage',
              values: dataSet
            });
          }
        };
      };

      benchmark();
    });
  }

  measureLatencyOfWebWorkersWithBroadcastChannel() {
    return new Promise(resolve => {
      if (!BROADCAST_CHANNEL_SUPPORT) {
        console.error('The BroadcastChannel API is not supported.');
        resolve(null);
        return;
      }

      var dataSet = [];
      var benchmark = () => {
        var now = Date.now();
        var highResolutionBefore = window.performance.now();

        this.channel.postMessage(now);
        this.channel.onmessage = evt => {
          var timestamps = evt.data;
          var now = Date.now();
          var highResolutionAfter = window.performance.now();
          var data = [
            timestamps[0],
            now - timestamps[1],
            highResolutionAfter - highResolutionBefore
          ];

          dataSet.push(data);

          if (dataSet.length <= ITERATIONS) {
            benchmark(dataSet);
          } else {
            resolve({
              name: 'Web Workers with Broadcast Channel',
              shortName: 'BC channel',
              values: dataSet
            });
          }
        };
      };

      benchmark();
    });
  }
}
