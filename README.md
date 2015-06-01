# ![Web workers benchmark](https://raw.githubusercontent.com/gmarty/latency-web-workers/master/app/img/icons/32.png "Web workers benchmark") Web workers benchmark

> Benchmark various aspects of Web workers.

## What?

A technical app to benchmark Web workers using different methods:

* [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage)
* [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel/BroadcastChannel)
* the [threads](https://github.com/gaia-components/threads) library

For each method, the upload (main thread -> worker) and download (worker -> main
thread) latencies are measured. The roundtrip is also measured using
high-resolution timers.

## Results

Results measured on a Flame.

### Creation time

![Creation time](https://rawgit.com/gmarty/latency-web-workers/master/app/img/creation-barchart.svg)

![Creation time scatterplot](https://rawgit.com/gmarty/latency-web-workers/master/app/img/creation-scatter-plot.svg)

### Latency

![Latency](https://rawgit.com/gmarty/latency-web-workers/master/app/img/latency-barchart.svg)

![Latency scatterplot](https://rawgit.com/gmarty/latency-web-workers/master/app/img/latency-scatter-plot.svg)

### Transfer speed

![Speed transfer](https://rawgit.com/gmarty/latency-web-workers/master/app/img/transfer-speed-scatter-plot.svg)
