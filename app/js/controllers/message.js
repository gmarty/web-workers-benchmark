/* global threads */

/* Benchmark the transfer speed of Web workers. */

import { Controller } from 'components/fxos-mvc/dist/mvc';

import MessageView from 'js/views/message';

import * as threads from 'components/threads/threads';

const ITERATIONS = 100;
const BROADCAST_CHANNEL_SUPPORT = 'BroadcastChannel' in window;

export default class MessageController extends Controller {
  constructor(options) {
    this.view = new MessageView({
      el: document.getElementById('message')
    });
    super(options);
  }

  main() {
    this.view.setActive(true);

    var threadClient = null;
    if (BROADCAST_CHANNEL_SUPPORT) {
      threads.manager({
        'message-service': {
          src: 'workers/message-service.js',
          type: 'worker'
        }
      });

      threadClient = threads.client('message-service');
    }

    this.client = threadClient;
    this.rawWorker = new Worker('workers/message-worker.js');
    this.channel = BROADCAST_CHANNEL_SUPPORT ? new window.BroadcastChannel('message') : {};

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

    this.benchmarkWebWorkersWithPostMessage()
      .then((dataSet) => {
        if (dataSet) {
          dataSets.push(dataSet);
        }

        return this.benchmarkWebWorkersWithBroadcastChannel();
      })
      .then((dataSet) => {
        if (dataSet) {
          dataSets.push(dataSet);
        }

        return this.benchmarkThreads();
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

  benchmarkThreads() {
    var size = 1;

    return new Promise(resolve => {
      if (!BROADCAST_CHANNEL_SUPPORT) {
        console.error('The BroadcastChannel API is not supported.');
        resolve(null);
        return;
      }

      var dataSet = [];
      var benchmark = () => {
        var object = this.getObject(size);
        var highResolutionBefore = window.performance.now();

        this.client
          .method('ping', object)
          .then(() => {
            var highResolutionAfter = window.performance.now();
            var data = [
              highResolutionAfter - highResolutionBefore,
              size
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

        size += (1024 * 20);
      };

      benchmark();
    });
  }

  benchmarkWebWorkersWithPostMessage() {
    var size = 1;

    return new Promise(resolve => {
      var dataSet = [];
      var benchmark = () => {
        var object = this.getObject(size);
        var highResolutionBefore = window.performance.now();

        this.rawWorker.postMessage(object);
        this.rawWorker.onmessage = () => {
          var highResolutionAfter = window.performance.now();
          var data = [
            highResolutionAfter - highResolutionBefore,
            size
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

        size += (1024 * 20);
      };

      benchmark();
    });
  }

  benchmarkWebWorkersWithBroadcastChannel() {
    var size = 1;

    return new Promise(resolve => {
      if (!BROADCAST_CHANNEL_SUPPORT) {
        console.error('The BroadcastChannel API is not supported.');
        resolve(null);
        return;
      }

      var dataSet = [];
      var benchmark = () => {
        var object = this.getObject(size);
        var highResolutionBefore = window.performance.now();

        this.channel.postMessage(object);
        this.channel.onmessage = () => {
          var highResolutionAfter = window.performance.now();
          var data = [
            highResolutionAfter - highResolutionBefore,
            size
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

        size += (1024 * 20);
      };

      benchmark();
    });
  }

  getObject(size = 0) {
    var object = new Uint8Array(size);

    for (var i = 0; i < size; i++) {
      object[i] = Math.random() * 0xFF;
    }

    return object;
  }
}
