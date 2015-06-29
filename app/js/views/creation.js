/* global mean, median, stdev, percentile */

import { View } from 'components/fxos-mvc/dist/mvc';

import * as d3 from 'components/d3/d3.min';
import 'components/node-isnumber/index';
import 'components/node-stats-lite/stats';

const ITERATIONS = 100;

var template = `
  <div class="results">
    <gaia-header action="back">
      <h1>Creation of Web workers</h1>
      <button id="reload" data-icon="reload"></button>
    </gaia-header>
    <div id="table"></div>
    <div id="barchart"></div>
    <p class="fine-prints">Lower is better.</p>
    <div id="scatterplot"></div>
  </div>
  `;

export default class CreationView extends View {
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
      barchart: this.$('#barchart'),
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

  setLoader(loading = false) {
    this.el.classList.toggle('loading', loading);
  }

  processData(dataSets) {
    var barChartData = [];
    var scatterPlotData = [];

    dataSets.forEach(dataSet => {
      dataSet.values.shift(); // Remove the first measure.

      var title = dataSet.name;
      var shortTitle = dataSet.shortName;
      var values = dataSet.values;

      var roundtripVal = values.map(value => value[0]);

      var roundtripMean = mean(roundtripVal);
      var roundtripMedian = median(roundtripVal);
      var roundtripStdev = stdev(roundtripVal);
      var roundtrip90Percentile = percentile(roundtripVal, 0.90);
      var roundtrip95Percentile = percentile(roundtripVal, 0.95);

      var tpl = `
        <header>
          <h2>${title}</h2>
        </header>
        <table>
          <tr>
            <th>Mean</th>
            <th>Median</th>
            <th>Std dev</th>
            <th>90th %ile</th>
            <th>95th %ile</th>
          </tr>
          <tr>
            <td>${(roundtripMean).toFixed(3)}</td>
            <td>${(roundtripMedian).toFixed(3)}</td>
            <td>${(roundtripStdev).toFixed(3)}</td>
            <td>${(roundtrip90Percentile).toFixed(3)}</td>
            <td>${(roundtrip95Percentile).toFixed(3)}</td>
          </tr>
        </table>
        <p class="fine-prints">Values are creation time in ms.</p>
      `;

      var container = document.createElement('div');
      container.innerHTML = tpl;
      this.elements.table.appendChild(container);

      barChartData.push({
        data: [
          {name: 'x', value: roundtripMean},
          {name: 'M', value: roundtripMedian},
          {name: '90%', value: roundtrip90Percentile},
          {name: '95%', value: roundtrip95Percentile}
        ],
        title: shortTitle
      });

      scatterPlotData.push({
        data: values.map((value, index) => {
          return {
            name: shortTitle,
            value: value[0],
            id: index
          };
        }),
        regression: roundtripMean
      });
    });

    this.plotBarChart(barChartData);
    this.plotScatter(scatterPlotData);
  }

  initTable() {
    this.elements.table.innerHTML = '';
  }

  // Graph related methods.
  initBarChart() {
    this.elements.barchart.innerHTML = '';

    this.graph.g = {};
    this.graph.g.margin = {top: 5, right: 45, bottom: 30, left: 30};
    this.graph.g.width = 320 - this.graph.g.margin.left - this.graph.g.margin.right;
    this.graph.g.height = 240 - this.graph.g.margin.top - this.graph.g.margin.bottom;

    this.graph.g.x = d3.scale.ordinal()
      .rangeRoundBands([0, this.graph.g.width], 0.1);

    this.graph.g.y = d3.scale.linear()
      .domain([0, this.graph.g.maxY])
      .range([this.graph.g.height, 0]);

    this.graph.g.xAxis = d3.svg.axis()
      .scale(this.graph.g.x)
      .orient('bottom')
      .tickFormat(d => d.split(' ')[0]);

    this.graph.g.yAxis = d3.svg.axis()
      .scale(this.graph.g.y)
      .orient('left');

    this.graph.g.color = d3.scale.category10();

    this.graph.g.chart = d3.select(this.elements.barchart).append('svg')
      .attr('width', this.graph.g.width + this.graph.g.margin.left + this.graph.g.margin.right)
      .attr('height', this.graph.g.height + this.graph.g.margin.top + this.graph.g.margin.bottom).append('g')
      .attr('transform', `translate(${this.graph.g.margin.left},${this.graph.g.margin.top})`)
      .style('font-size', '12px')
      .style('font-family', 'Arial');

    this.graph.g.xAxisEl = this.graph.g.chart.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0,${this.graph.g.height})`);

    this.graph.g.yAxisEl = this.graph.g.chart.append('g')
      .attr('class', 'y axis');

    this.graph.g.yAxisEl
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Time (ms)');

    this.graph.g.maxY = 0;
    this.graph.g.data = [];
  }

  plotBarChart(dataSets) {
    // First, we aggregate the data to get the maximum possible value.
    dataSets.forEach((data, index) => {
      this.graph.g.data = this.graph.g.data.concat(data.data);

      data.data.forEach(item => {
        item.name += ` ${index} `;
      });

      // Caption for each measured set.
      this.graph.g.xAxisEl
        .append('text')
        .attr('transform', `translate(${(index * this.graph.g.width / dataSets.length)},12)`)
        .attr('y', 6)
        .attr('dy', '.71em')
        .text(` ${data.title} `);
    });

    this.graph.g.maxY = d3.max(this.graph.g.data, d => d.value);

    this.graph.g.x.domain(this.graph.g.data.map(d => d.name));
    this.graph.g.y.domain([0, this.graph.g.maxY]);

    this.graph.g.xAxisEl
      .append('g')
      .style('font-size', '8px')
      .call(this.graph.g.xAxis);
    this.graph.g.yAxisEl.call(this.graph.g.yAxis);

    this.graph.g.chart.selectAll('.bar')
      .data(this.graph.g.data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => this.graph.g.x(d.name))
      .attr('y', d => this.graph.g.y(d.value))
      .attr('height', d => this.graph.g.height - this.graph.g.y(d.value))
      .attr('width', this.graph.g.x.rangeBand())
      .style('fill', d => this.graph.g.color(d.name.split(' ')[0]));

    // Captions for the different statistic functions plotted.
    var caption = this.graph.g.chart.append('g')
      .attr('class', 'caption')
      .attr('transform', `translate(${this.graph.g.margin.right},0)`);

    var legend = caption.selectAll('.legend')
      .data(dataSets[0].data)
      .enter().append('g')
      .attr('class', 'legend')
      .attr('transform', (d, i) => `translate(0,${(i * 20)})`);

    legend.append('rect')
      .attr('x', this.graph.g.width - 18)
      .attr('width', 18)
      .attr('height', 18)
      .style('fill', d => this.graph.g.color(d.name.split(' ')[0]));

    legend.append('text')
      .attr('x', this.graph.g.width - 24)
      .attr('y', 9)
      .attr('dy', '.35em')
      .style('text-anchor', 'end')
      .text(d => d.name.split(' ')[0]);
  }

  initScatterPlot() {
    this.elements.scatterplot.innerHTML = '';

    this.graph.s = {};
    this.graph.s.margin = {top: 5, right: 5, bottom: 30, left: 30};
    this.graph.s.width = 320 - this.graph.s.margin.left - this.graph.s.margin.right;
    this.graph.s.height = 240 - this.graph.s.margin.top - this.graph.s.margin.bottom;

    this.graph.s.x = d3.scale.linear()
      .domain([0, ITERATIONS])
      .range([0, this.graph.s.width]);

    this.graph.s.y = d3.scale.linear()
      .domain([0, 1])
      .range([this.graph.s.height, 0]);

    this.graph.s.xAxis = d3.svg.axis()
      .scale(this.graph.s.x)
      .orient('bottom');

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
      .text('Measure');

    this.graph.s.yAxisEl
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Time (ms)');

    this.graph.s.maxY = 0;
    this.graph.s.data = [];
  }

  plotScatter(dataSets) {
    // First, we aggregate the data to get the maximum possible values.
    dataSets.forEach(data => {
      this.graph.s.data = this.graph.s.data.concat(data.data);
    });

    this.graph.s.maxY = d3.max(this.graph.s.data, d => d.value);

    this.graph.s.y.domain([0, this.graph.s.maxY]);

    this.graph.s.xAxisEl.call(this.graph.s.xAxis);
    this.graph.s.yAxisEl.call(this.graph.s.yAxis);

    // Let's plot the dots...
    this.graph.s.chart.selectAll('.dot')
      .data(this.graph.s.data)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('r', 2)
      .attr('cx', d => this.graph.s.x(d.id))
      .attr('cy', d => this.graph.s.y(d.value))
      .style('fill', d => this.graph.s.color(d.name));

    // Now that the X axis is final, we can display the regression lines.
    dataSets.forEach(data => {
      this.graph.s.chart.append('line')
        .attr('class', 'regression')
        .attr('x1', this.graph.s.x(0))
        .attr('y1', this.graph.s.y(data.regression))
        .attr('x2', this.graph.s.x(ITERATIONS))
        .attr('y2', this.graph.s.y(data.regression))
        .style('stroke-width', 2)
        .style('stroke', this.graph.s.color(data.data[0].name));
    });

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
