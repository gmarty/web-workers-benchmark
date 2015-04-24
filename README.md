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

Results as measured on a Flame

![Barchart](https://rawgit.com/gmarty/latency-web-workers/master/app/img/barchart.svg)

![Scattergraph](https://rawgit.com/gmarty/latency-web-workers/master/app/img/scattergraph.svg)
