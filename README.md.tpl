Yaps-node is a [topic-based](http://en.wikipedia.org/wiki/Publish–subscribe_pattern#Message_filtering) [publish/subscribe](http://en.wikipedia.org/wiki/Publish/subscribe) library for Node js.

### Key Features
* asynchronous
* embeddable
* designed for micro-services


### Examples
Publishing and subscribing locally (same process)
```javascript
{{{examples.pubSubLocal}}}
```
Publishing and subscribing over tcp
```javascript
{{{examples.pubSubTcp}}}
```
Publishing and subscribing over web sockets
```javascript
{{{examples.pubSubWs}}}
```

### Topic Filtering


## Versioning

Yaps-node uses [Semantic Versioning](http://semver.org/) for predictable versioning.

## Alternatives

These are a few alternative projects that also implement topic based publish subscribe in JavaScript.

* https://raw.githubusercontent.com/mroderick/PubSubJS/
* http://www.joezimjs.com/projects/publish-subscribe-jquery-plugin/
* http://amplifyjs.com/api/pubsub/
* http://radio.uxder.com/ — oriented towards 'channels', free of dependencies
* https://github.com/pmelander/Subtopic - supports vanilla, underscore, jQuery and is even available in NuGet