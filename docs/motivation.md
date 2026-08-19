# Motivation

This project originally started as a way to expose Discord event data to the [Cupertino PoGO Map project](https://github.com/80PercentLean/cupertino-pogo-map). We wanted to easily share upcoming meetups so people could see when and where we host events outside of [Campfire](https://campfire.nianticlabs.com).

To make this possible, we use Scopely Explore's official Campfire Bot, which automatically creates Discord events whenever we publish a meetup on Campfire. Goose Bot then exposes that event data through its REST API, allowing Cupertino PoGO Map deployments to retrieve and display upcoming meetups.

Once the REST API was up and running, we decided to expand the bot with a message scheduler. We had previously relied on an existing pre-made solution, but its free plan limited how far in advance messages could be scheduled. Rather than paying for that, we decided to build our own solution. 😂

The bot's relatively small scope also made it a great opportunity to experiment with Cloudflare's products and services. Beyond giving us a practical way to learn and work with serverless and edge computing technologies, Cloudflare also provided a cost-effective platform for essentially running a 24/7 Discord bot and REST API for free, as our projects aren't expected to generate significant traffic or workloads.
