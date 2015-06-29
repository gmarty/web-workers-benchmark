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
    this.sharedWorker = new SharedWorker('workers/latency-shared-worker.js');
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
    this.sharedWorker.port.start();
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

        return this.measureLatencyOfSharedWorkersWithPostMessage();
      })
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
        var highResolutionBefore = window.performance.now();

        this.client
          .method('ping', 0)
          .then(() => {
            var highResolutionAfter = window.performance.now();
            var data = [
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
        var highResolutionBefore = window.performance.now();

        this.rawWorker.postMessage(0);
        this.rawWorker.onmessage = () => {
          var highResolutionAfter = window.performance.now();
          var data = [
            highResolutionAfter - highResolutionBefore
          ];

          dataSet.push(data);

          if (dataSet.length <= ITERATIONS) {
            benchmark(dataSet);
          } else {
            resolve({
              name: 'Web Workers with postMessage',
              shortName: 'Web message',
              values: dataSet
            });
          }
        };
      };

      benchmark();
    });
  }

  measureLatencyOfSharedWorkersWithPostMessage() {
    return new Promise(resolve => {
      var dataSet = [];
      var benchmark = () => {
        var highResolutionBefore = window.performance.now();

        this.sharedWorker.port.postMessage(0);
        this.sharedWorker.port.onmessage = () => {
          var highResolutionAfter = window.performance.now();
          var data = [
            highResolutionAfter - highResolutionBefore
          ];

          dataSet.push(data);

          if (dataSet.length <= ITERATIONS) {
            benchmark(dataSet);
          } else {
            resolve({
              name: 'Shared Workers with postMessage',
              shortName: 'Shared message',
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
        var highResolutionBefore = window.performance.now();

        this.channel.postMessage(0);
        this.channel.onmessage = () => {
          var highResolutionAfter = window.performance.now();
          var data = [
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
