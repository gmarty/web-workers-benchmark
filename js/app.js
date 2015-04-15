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

      this.elements.reload.addEventListener('click', () => {
        this.startMeasuring();
      });
    },

    startMeasuring: function() {
      this.elements.table.innerHTML = '';
      this.initPlot();

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
            this.processData('threads library', values,
              'threads');
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
          this.processData('Web Workers with postMessage', values,
            'postMessage');
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
          this.processData('Web Workers with Broadcast Channel', values,
            'BC channel');
        }
      };
    },

    processData: function(title, values, shortTitle) {
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
        {name: 'x', value: roundtripMean},
        {name: 'M', value: roundtripMedian},
        {name: '90%', value: roundtrip90Percentile},
        {name: '95%', value: roundtrip95Percentile}
      ], shortTitle);
    },

    // Graph related methods.
    initPlot: function() {
      this.elements.chart.innerHTML = '';

      this.graph = {};
      this.graph.margin = {top: 5, right: 45, bottom: 30, left: 30};
      this.graph.width = 320 - this.graph.margin.left - this.graph.margin.right;
      this.graph.height = 240 - this.graph.margin.top - this.graph.margin.bottom;

      this.graph.x = d3.scale.ordinal()
        .rangeRoundBands([0, this.graph.width], .1);

      this.graph.y = d3.scale.linear()
        .domain([0, this.graph.maxY])
        .range([this.graph.height, 0]);

      this.graph.xAxis = d3.svg.axis()
        .scale(this.graph.x)
        .orient('bottom');

      this.graph.yAxis = d3.svg.axis()
        .scale(this.graph.y)
        .orient('left')
        .ticks(10);

      this.graph.color = d3.scale.category10();

      this.graph.chart = d3.select('#chart').append('svg')
        .attr('width', this.graph.width + this.graph.margin.left + this.graph.margin.right)
        .attr('height', this.graph.height + this.graph.margin.top + this.graph.margin.bottom).append('g')
        .attr('transform', `translate(${this.graph.margin.left},${this.graph.margin.top})`);

      this.graph.chart.xAxisEl = this.graph.chart.append('g')
        .attr('class', 'x axis')
        .attr('transform', `translate(0,${this.graph.height})`);

      this.graph.chart.yAxisEl = this.graph.chart.append('g')
        .attr('class', 'y axis');

      this.graph.chart.yAxisEl
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 6)
        .attr('dy', '.71em')
        .style('text-anchor', 'end')
        .text('Latency in ms');

      this.graph.maxY = 0;
      this.graph.set = 0;
      this.graph.data = [];
    },

    plotBarChart: function(data, title) {
      if (this.graph.set === 1) {
        this.graph.x.domain(data.map(d => d.name));

        // Captions for the different statistic functions plotted.
        var caption = this.graph.chart.append('g')
          .attr('class', 'caption')
          .attr('transform', `translate(${this.graph.margin.right},0)`);

        var legend = caption.selectAll('.legend')
          .data(data)
          .enter().append('g')
          .attr('class', 'legend')
          .attr('transform', (d, i) => `translate(0,${(i * 20)})`);

        legend.append('rect')
          .attr('x', this.graph.width - 18)
          .attr('width', 18)
          .attr('height', 18)
          .style('fill', d => this.graph.color(d.name));

        legend.append('text')
          .attr('x', this.graph.width - 24)
          .attr('y', 9)
          .attr('dy', '.35em')
          .style('text-anchor', 'end')
          .text(d => d.name);
      }

      data.forEach(item => item.name += ` ${this.graph.set} `);

      this.graph.data = this.graph.data.concat(data);

      // Caption for each measured set.
      this.graph.chart.xAxisEl
        .append('text')
        .attr('transform', `translate(${(this.graph.set * (this.graph.width) / 3)},12)`)
        .attr('y', 6)
        .attr('dy', '.71em')
        .text(` ${title} `);

      this.graph.set++;

      if (this.graph.set >= 3) {
        this.graph.maxY = d3.max(this.graph.data, d => d.value);

        this.graph.x.domain(this.graph.data.map(d => d.name));
        this.graph.y.domain([0, this.graph.maxY]);

        this.graph.chart.xAxisEl.call(this.graph.xAxis);
        this.graph.chart.yAxisEl.call(this.graph.yAxis);

        this.graph.chart.selectAll('.bar')
          .data(this.graph.data)
          .enter().append('rect')
          .attr('class', 'bar')
          .attr('x', d => this.graph.x(d.name))
          .attr('y', d => this.graph.y(d.value))
          .attr('height', d => this.graph.height - this.graph.y(d.value))
          .attr('width', this.graph.x.rangeBand())
          .style('fill', d => this.graph.color(d.name.split(' ')[0]));
      }
    }
  };

  app.init();
});
