/* global regression */
/* global mean, median, stdev, percentile */

import { View } from 'components/fxos-mvc/dist/mvc';

import * as d3 from 'components/d3/d3.min';
import 'components/regression-js/build/regression.min';
import 'components/node-isnumber/index';
import 'components/node-stats-lite/stats';

const SIZE_UNIT = 1024; // 1 B

var template = `
  <gaia-header action="back">
    <h1>Transfer speed of Web workers</h1>
    <button id="reload" data-icon="reload"></button>
  </gaia-header>
  <div id="table"></div>
  <div id="scatterplot"></div>
  `;

export default class MessageView extends View {
  constructor(options) {
    this.graph = {};

    super(options);
  }

  init(controller) {
    super(controller);

    this.render();

    this.on('click', '#reload', () => {
      controller.startMeasuring();
    });

    this.elements = {
      header: this.$('gaia-header'),
      table: this.$('#table'),
      scatterplot: this.$('#scatterplot')
    };

    this.elements.header.addEventListener('action', () => {
      controller.setActiveController('home');
    });
  }

  template() {
    return template;
  }

  setActive(active) {
    this.el.classList.toggle('active', active);
  }

  processData(dataSets) {
    dataSets.forEach(dataSet => {
      dataSet.values.shift(); // Remove the first measure.

      var title = dataSet.name;
      var shortTitle = dataSet.shortName;
      var values = dataSet.values;

      var uploadVal = values.map(value => value[3] / value[0] / SIZE_UNIT);
      var downloadVal = values.map(value => value[3] / value[1] / SIZE_UNIT);
      var roundtripVal = values.map(value => value[3] / value[2] / SIZE_UNIT);
      var roundtripCorrectedVal = values.map(value => value[3] / value[2]);

      var uploadMean = mean(uploadVal);
      var downloadMean = mean(downloadVal);
      var roundtripMean = mean(roundtripVal);
      var uploadMedian = median(uploadVal);
      var downloadMedian = median(downloadVal);
      var roundtripMedian = median(roundtripVal);
      var uploadStdev = stdev(uploadVal);
      var downloadStdev = stdev(downloadVal);
      var roundtripStdev = stdev(roundtripVal);
      var upload90Percentile = percentile(uploadVal, 0.90);
      var download90Percentile = percentile(downloadVal, 0.90);
      var roundtrip90Percentile = percentile(roundtripVal, 0.90);
      var upload95Percentile = percentile(uploadVal, 0.95);
      var download95Percentile = percentile(downloadVal, 0.95);
      var roundtrip95Percentile = percentile(roundtripVal, 0.95);
      // 1024 is to get bytes.
      // Value is round trip, so we need to divide it by 2.
      // Then multiply by the duration of a frame (16 ms).
      var maxMessageSize = mean(roundtripCorrectedVal) * 1024 / 2 * 16;

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
        <p class="fine-prints">Unit is transfer speed in ${this.humanizeSize(SIZE_UNIT * 1.024)} / ms.</p>
        <p>Keep message size under ~${this.humanizeSize(maxMessageSize)}.</p>
      `;

      var container = document.createElement('div');
      container.innerHTML = tpl;
      this.elements.table.appendChild(container);

      this.plotScatter(values.map(value => {
        return {
          name: shortTitle,
          value: value[2],
          size: value[3]
        };
      }));
    });
  }

  humanizeSize(bytes = 0) {
    var units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];

    var e = Math.max(Math.floor(Math.log(bytes) / Math.log(1024)), 0);
    return `${Math.round(bytes / Math.pow(1024, e))} ${units[e]}`;
  }

  initTable() {
    this.elements.table.innerHTML = '';
  }

  // Graph related methods.
  initScatterPlot() {
    this.elements.scatterplot.innerHTML = '';

    this.graph.s = {};
    this.graph.s.margin = {top: 5, right: 5, bottom: 30, left: 30};
    this.graph.s.width = 320 - this.graph.s.margin.left - this.graph.s.margin.right;
    this.graph.s.height = 240 - this.graph.s.margin.top - this.graph.s.margin.bottom;

    this.graph.s.x = d3.scale.linear()
      .domain([0, 1])
      .range([0, this.graph.s.width]);

    this.graph.s.y = d3.scale.linear()
      .domain([0, 1])
      .range([this.graph.s.height, 0]);

    this.graph.s.xAxis = d3.svg.axis()
      .scale(this.graph.s.x)
      .orient('bottom')
      .tickFormat(d => `${Math.round(d / 1024)}`);

    this.graph.s.yAxis = d3.svg.axis()
      .scale(this.graph.s.y)
      .orient('left');

    this.graph.s.color = d3.scale.category10();

    this.graph.s.chart = d3.select(this.elements.scatterplot).append('svg')
      .attr('width', this.graph.s.width + this.graph.s.margin.left + this.graph.s.margin.right)
      .attr('height', this.graph.s.height + this.graph.s.margin.top + this.graph.s.margin.bottom).append('g')
      .attr('transform', `translate(${this.graph.s.margin.left},${this.graph.s.margin.top})`)
      .style('font-size', '12px')
      .style('font-family', 'Arial');

    this.graph.s.xAxisEl = this.graph.s.chart.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0,${this.graph.s.height})`);

    this.graph.s.yAxisEl = this.graph.s.chart.append('g')
      .attr('class', 'y axis');

    this.graph.s.xAxisEl
      .append('text')
      .attr('x', this.graph.s.width)
      .attr('y', -6)
      .style('text-anchor', 'end')
      .text('Message size (kB)');

    this.graph.s.yAxisEl
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Latency (ms)');

    this.graph.s.maxY = 0;
    this.graph.s.set = 0;
    this.graph.s.data = [];
  }

  plotScatter(data) {
    this.graph.s.data = this.graph.s.data.concat(data);

    this.graph.s.set++;

    this.graph.s.maxX = d3.max(this.graph.s.data, d => d.size);
    this.graph.s.maxY = d3.max(this.graph.s.data, d => d.value);

    this.graph.s.x.domain([0, this.graph.s.maxX]);
    this.graph.s.y.domain([0, this.graph.s.maxY]);

    this.graph.s.xAxisEl.call(this.graph.s.xAxis);
    this.graph.s.yAxisEl.call(this.graph.s.yAxis);

    this.graph.s.chart.selectAll('.dot')
      .data(this.graph.s.data)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('r', 2)
      .attr('cx', d => this.graph.s.x(d.size))
      .attr('cy', d => this.graph.s.y(d.value))
      .style('fill', d => this.graph.s.color(d.name));

    // Regression line
    var { equation } = regression('linear', data.map(d => [d.size, d.value]));

    this.graph.s.chart.append('line')
      .attr('class', 'regression')
      .attr('x1', this.graph.s.x(0))
      .attr('y1', this.graph.s.y(equation[1]))
      .attr('x2', this.graph.s.x(this.graph.s.maxX))
      .attr('y2', this.graph.s.y((this.graph.s.maxX * equation[0]) + equation[1]))
      .style('stroke-width', 2)
      .style('stroke', this.graph.s.color(data[0].name));

    if (this.graph.s.set < 3) {
      return;
    }

    // Legend
    var legend = this.graph.s.chart.selectAll('.legend')
      .data(this.graph.s.color.domain())
      .enter().append('g')
      .attr('class', 'legend')
      .attr('transform', (d, i) => `translate(0,${(i * 20)})`);

    legend.append('rect')
      .attr('x', this.graph.s.width - 18)
      .attr('width', 18)
      .attr('height', 18)
      .style('fill', this.graph.s.color);

    legend.append('text')
      .attr('x', this.graph.s.width - 24)
      .attr('y', 9)
      .attr('dy', '.35em')
      .style('text-anchor', 'end')
      .text(d => d);
  }
}
