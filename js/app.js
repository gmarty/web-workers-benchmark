'use strict';

require([
  'bower_components/threads/threads',
  'bower_components/d3/d3.min'
], (threads, d3) => {
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
      table: document.getElementById('table'),
      chart: document.getElementById('chart')
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

      this.initPlot();

      this.elements.reload.addEventListener('click', () => {
        this.startMeasuring();
      });
    },

    startMeasuring: function() {
      this.elements.table.innerHTML = '';
      this.elements.chart.innerHTML = '';

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

      var uploadMean = mean(uploadVal);
      var downloadMean = mean(downloadVal);
      var roundtripMean = mean(roundtripVal);
      var uploadMedian = median(uploadVal);
      var downloadMedian = median(downloadVal);
      var roundtripMedian = median(roundtripVal);
      var uploadStdev = stdev(uploadVal);
      var downloadStdev = stdev(downloadVal);
      var roundtripStdev = stdev(roundtripVal);
      var upload90Percentile = percentile(uploadVal, .90);
      var download90Percentile = percentile(downloadVal, .90);
      var roundtrip90Percentile = percentile(roundtripVal, .90);
      var upload95Percentile = percentile(uploadVal, .95);
      var download95Percentile = percentile(downloadVal, .95);
      var roundtrip95Percentile = percentile(roundtripVal, .95);

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
            <th>90th %ile</th>
            <th>95th %ile</th>
          </tr>
          <tr>
            <th>U</th>
            <td>${(uploadMean).toFixed(3)}</td>
            <td>${(uploadMedian).toFixed(3)}</td>
            <td>${(uploadStdev).toFixed(3)}</td>
            <td>${(upload90Percentile).toFixed(3)}</td>
            <td>${(upload95Percentile).toFixed(3)}</td>
          </tr>
          <tr>
            <th>D</th>
            <td>${(downloadMean).toFixed(3)}</td>
            <td>${(downloadMedian).toFixed(3)}</td>
            <td>${(downloadStdev).toFixed(3)}</td>
            <td>${(download90Percentile).toFixed(3)}</td>
            <td>${(download95Percentile).toFixed(3)}</td>
          </tr>
          <tr>
            <th>RT</th>
            <td>${(roundtripMean).toFixed(3)}</td>
            <td>${(roundtripMedian).toFixed(3)}</td>
            <td>${(roundtripStdev).toFixed(3)}</td>
            <td>${(roundtrip90Percentile).toFixed(3)}</td>
            <td>${(roundtrip95Percentile).toFixed(3)}</td>
          </tr>
        </table>
      `;

      var container = document.createElement('div');
      container.innerHTML = tpl;
      this.elements.table.appendChild(container);

      this.plotBarChart([
        {name: 'Mean', value: roundtripMean},
        {name: 'Median', value: roundtripMedian},
        {name: '90th %ile', value: roundtrip90Percentile},
        {name: '95th %ile', value: roundtrip95Percentile}
      ]);
    },

    // Graph related methods.
    initPlot: function() {
      this.graph = {};
      this.graph.margin = {top: 5, right: 5, bottom: 20, left: 35};
      this.graph.width = 320 - this.graph.margin.left - this.graph.margin.right;
      this.graph.height = 240 - this.graph.margin.top - this.graph.margin.bottom;
    },

    plotBarChart: function(data) {
      var x = d3.scale.ordinal()
        .rangeRoundBands([0, this.graph.width], .1);

      var y = d3.scale.linear()
        .domain([0, d3.max(data)])
        .range([this.graph.height, 0]);

      var xAxis = d3.svg.axis()
        .scale(x)
        .orient('bottom');

      var yAxis = d3.svg.axis()
        .scale(y)
        .orient('left')
        .ticks(10);

      var color = d3.scale.category10();

      var chart = d3.select('#chart').append('svg')
        .attr('width', this.graph.width + this.graph.margin.left + this.graph.margin.right)
        .attr('height', this.graph.height + this.graph.margin.top + this.graph.margin.bottom).append('g')
        .attr('transform', 'translate(' + this.graph.margin.left + ',' + this.graph.margin.top + ')');

      x.domain(data.map(d => d.name));

      y.domain([0, d3.max(data, d => d.value)]);

      chart.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + this.graph.height + ')')
        .call(xAxis);

      chart.append('g')
        .attr('class', 'y axis')
        .call(yAxis)
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 6)
        .attr('dy', '.71em')
        .style('text-anchor', 'end')
        .text('Latency in ms');

      color.domain(data);

      chart.selectAll('.bar')
        .data(data)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.name))
        .attr('y', d => y(d.value))
        .attr('height', d => this.graph.height - y(d.value))
        .attr('width', x.rangeBand())
        .style('fill', d => color(d.name));
    }
  };

  app.init();
});
