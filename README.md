# ![Latency of Web workers](https://raw.githubusercontent.com/gmarty/latency-web-workers/master/img/icons/32.png "Latency of Web workers") Latency of Web workers

> Measure the latency of Web workers.

## What?

A technical app to measure the latency of communications with Web workers using
different methods:

* [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage)
* [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel/BroadcastChannel)
* the [threads](https://github.com/gaia-components/threads) library

For each method, the upload (main thread -> worker) and download (worker -> main
thread) latencies are measured. The roundtrip is also measured using
high-resolution timers.

## Results

Results as measured on a Flame

![Barchart](https://rawgit.com/gmarty/latency-web-workers/master/img/barchart.svg)

![Scattergraph](https://rawgit.com/gmarty/latency-web-workers/master/img/scattergraph.svg)
