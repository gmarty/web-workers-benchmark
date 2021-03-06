/* Benchmark the time to spawn workers. */
// Note: Shared workers spawning can't be benchmarked as they can't be deleted.

import { Controller } from 'components/fxos-mvc/dist/mvc';

import CreationView from 'js/views/creation';

const ITERATIONS = 100;
const BROADCAST_CHANNEL_SUPPORT = 'BroadcastChannel' in window;

export default class CreationController extends Controller {
  constructor(options) {
    this.view = new CreationView({
      el: document.getElementById('creation')
    });
    super(options);
  }

  main() {
    this.view.setActive(true);

    this.bcWorker = new Worker('workers/creation-worker.js');

    // Start benchmarking.
    this.init();
  }

  teardown() {
    this.bcWorker.terminate();

    this.view.setActive(false);
  }

  init() {
    this.startMeasuring();
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

    this.benchmarkCreationOfWebWorkers()
      .then((dataSet) => {
        if (dataSet) {
          dataSets.push(dataSet);
        }

        return this.benchmarkCreationOfBroadcastChannels();
      })
      .then((dataSet) => {
        if (dataSet) {
          dataSets.push(dataSet);
        }

        return this.benchmarkCreationOfIframe();
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

  benchmarkCreationOfWebWorkers() {
    return new Promise(resolve => {
      var dataSet = [];
      var benchmark = () => {
        var highResolutionBefore = window.performance.now();

        var worker = new Worker('workers/creation-worker.js');

        worker.postMessage(0);
        worker.onmessage = () => {
          var highResolutionAfter = window.performance.now();
          var data = [
            highResolutionAfter - highResolutionBefore
          ];

          dataSet.push(data);
          worker.terminate();

          if (dataSet.length <= ITERATIONS) {
            benchmark(dataSet);
          } else {
            resolve({
              name: 'Web Workers',
              shortName: 'worker',
              values: dataSet
            });
          }
        };
      };

      benchmark();
    });
  }

  benchmarkCreationOfBroadcastChannels() {
    return new Promise(resolve => {
      if (!BROADCAST_CHANNEL_SUPPORT) {
        console.error('The BroadcastChannel API is not supported.');
        resolve(null);
        return;
      }

      var dataSet = [];
      var benchmark = () => {
        var highResolutionBefore = window.performance.now();

        var channel = new window.BroadcastChannel('creation');

        channel.postMessage(0);
        channel.onmessage = () => {
          var highResolutionAfter = window.performance.now();
          var data = [
            highResolutionAfter - highResolutionBefore
          ];

          dataSet.push(data);
          channel.close();

          if (dataSet.length <= ITERATIONS) {
            benchmark(dataSet);
          } else {
            resolve({
              name: 'Broadcast Channels',
              shortName: 'BC channel',
              values: dataSet
            });
          }
        };
      };

      benchmark();
    });
  }

  benchmarkCreationOfIframe() {
    return new Promise(resolve => {
      var dataSet = [];
      var benchmark = () => {
        var highResolutionBefore = window.performance.now();

        var iframe = document.createElement('iframe');
        iframe.src = 'workers/creation-window/index.html';
        document.body.appendChild(iframe);

        var receiveMessage = () => {
          var highResolutionAfter = window.performance.now();
          var data = [
            highResolutionAfter - highResolutionBefore
          ];

          dataSet.push(data);
          document.body.removeChild(iframe);

          if (dataSet.length <= ITERATIONS) {
            benchmark(dataSet);
          } else {
            resolve({
              name: 'Iframes',
              shortName: 'iframe',
              values: dataSet
            });
          }
          window.removeEventListener('message', receiveMessage);
        };

        window.addEventListener('message', receiveMessage);

        iframe.contentWindow.addEventListener('load', function() {
          iframe.contentWindow.postMessage(0, '*');
        });
      };

      benchmark();
    });
  }
}
