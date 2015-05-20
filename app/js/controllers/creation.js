/* Benchmark the time to spawn workers. */
// Note: Shared workers spawning can't be benchmarked as they can't be deleted.

import { Controller } from 'components/fxos-mvc/dist/mvc';

import CreationView from 'js/views/creation';

const ITERATIONS = 100;

export default class CreationController extends Controller {
  constructor(options) {
    this.view = new CreationView({
      el: document.getElementById('creation')
    });
    super(options);
  }

  main() {
    this.view.setActive(true);

    // Start benchmarking.
    this.init();
  }

  teardown() {
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
    var worker = null;

    return new Promise(resolve => {
      var dataSet = [];
      var benchmark = () => {
        if (worker) {
          worker.terminate();
        }

        var now = Date.now();
        var highResolutionBefore = window.performance.now();

        worker = new Worker('workers/creation-worker.js');

        worker.postMessage(now);
        worker.onmessage = evt => {
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

  benchmarkCreationOfIframe() {
    return new Promise(resolve => {
      var dataSet = [];
      var benchmark = () => {
        var now = Date.now();
        var highResolutionBefore = window.performance.now();

        var iframe = document.createElement('iframe');
        iframe.src = 'workers/creation-window/index.html';
        document.body.appendChild(iframe);

        var receiveMessage = evt => {
          var timestamps = evt.data;
          var now = Date.now();
          var highResolutionAfter = window.performance.now();
          var data = [
            timestamps[0],
            now - timestamps[1],
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
          iframe.contentWindow.postMessage(now, '*');
        });
      };

      benchmark();
    });
  }
}
