<br />

<h1 align="center">Titan Reactor</h1>
<h3 align="center">An OpenBW 2.5D map and replay viewer.</h3>
<h5 align="center">Written in TypeScript with Three.JS.</h5>
<h5 align="center">Visit www.blacksheepwall.tv for more</h5>

<br>

<p align="center">
  <a href="https://twitter.com/imbateam" target="_blank">
    <img src="https://img.shields.io/twitter/follow/imbateam?label=%40imbateam&style=flat&colorA=000000&colorB=B7121F&logo=twitter&logoColor=B7121F" alt="Chat on Twitter">
  </a>
  <a href="https://discord.gg/ZZjjNvJ" target="_blank">
    <img src="https://img.shields.io/discord/835029442987950091?style=flat&colorA=B7121F&colorB=000000&label=discord&logo=discord&logoColor=FFFFFF" alt="Chat on Twitter">
  </a>
</p>
<p align="center">
<a href="https://www.youtube.com/@imbateam" target="_blank">
<img alt="YouTube Channel Subscribers" src="https://img.shields.io/youtube/channel/subscribers/UCj7TSQvBRYebRDIL0FW1MBQ?style=plastic" />
</a>
</p>
<br />

<p align="center">
  <img src="https://user-images.githubusercontent.com/586716/153120765-4fa4faf4-0e46-42b9-ba08-10ab5ace2f20.gif" />
</p>

<br/>

### About

This is Titan Reactor the WebGL renderer + plugin system. It consists of three primary parts in order to function:

-   Titan Reactor - main app that loads replays & maps and creates sessions for viewing. Can be served statically.
-   Cascbridge - an asset server that reads from your Starcraft install and serves it to Titan Reactor locally
-   UI Runtime - the part of the application the runs in the iframe for UI plugins. Can be served statically.
-   Plugins - the plugins that can be served statically.



### Requirements

-   A purchased copy of Starcraft Remastered.

### Developing Plugins

-   See the [CREATING_PLUGINS](https://github.com/imbateam-gg/titan-reactor/blob/dev/docs/CREATING_PLUGINS.md) document.

### Development Installation / Quick Start

Using node 18+, yarn 1.x

Clone this repo. The development branch is `dev` and `main` is used for releases.

In this repo:

`git lfs install`

`git lfs fetch`

`yarn install`

Now we want to run Titan Reactor, the ui runtime, the plugins, and cascbridge:

In your terminal run `yarn web` , in another terminal run `yarn runtime`, in the [plugins repo](https://github.com/alexpineda/titan-reactor-official-plugins) `npm run serve` and run [cascbridge](https://github.com/alexpineda/cascbridge).

The OpenBW wasm files are included (via git lfs). If you wish to build them yourself [visit the openbw fork repository](https://github.com/imbateam-gg/openbw).

[Code Architecture WIKI](https://github.com/imbateam-gg/titan-reactor/wiki/Code-Architecture)

### Legal

The documentation and functionality provided by Titan Reactor may only be utilized with assets provided by ownership of Starcraft. Starcraft® - Copyright © 1998 Blizzard Entertainment, Inc. All rights reserved. Starcraft and Blizzard Entertainment are trademarks or registered trademarks of Blizzard Entertainment, Inc. in the U.S. and/or other countries. Titan Reactor and any of its maintainers are in no way associated with or endorsed by Blizzard Entertainment®
