# ![Web workers benchmark](https://raw.githubusercontent.com/gmarty/web-workers-benchmark/master/app/img/icons/32.png "Web workers benchmark") Web workers benchmark

> Benchmark various aspects of Web workers.

## What?

A technical, mobile first app to benchmark different aspects related to web workers:

* Instantiation
* Messaging latency
* Transfer speed

The following communication methods are used:

* [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage)
* [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel/BroadcastChannel)
* the [threads](https://github.com/gaia-components/threads) library

## Results

Results measured on a Flame.

### Creation time

![Creation time](https://rawgit.com/gmarty/web-workers-benchmark/master/app/img/creation-barchart.svg)

![Creation time scatterplot](https://rawgit.com/gmarty/web-workers-benchmark/master/app/img/creation-scatter-plot.svg)

### Latency

![Latency](https://rawgit.com/gmarty/web-workers-benchmark/master/app/img/latency-barchart.svg)

![Latency scatterplot](https://rawgit.com/gmarty/web-workers-benchmark/master/app/img/latency-scatter-plot.svg)

### Transfer speed

![Speed transfer](https://rawgit.com/gmarty/web-workers-benchmark/master/app/img/transfer-speed-barchart.svg)

![Speed transfer scatterplot](https://rawgit.com/gmarty/web-workers-benchmark/master/app/img/transfer-speed-scatter-plot.svg)

## Compatibility

While this app itself works cross-browser, the thread.js library requires an environment that
supports the Broadcast Channel API (i.e. Firefox only currently). In the future, this may not be the
case. It will then be possible to run this app in other browsers.
