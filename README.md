# 0x40-web

A fairly complete HTML5/CSS3 Canvas + Web Audio clone of the 0x40 Hues Flash.

Should work on most modern browsers.

## Example pages:

[Default Hues  
![](docs/img/hues_default.png)](https://0x40.mon.im/)  
[420 Hues  
![](docs/img/hues_420.png)](https://420.mon.im/)  
[Halloween Hues  
![](docs/img/hues_hlwn.png)](https://spook.mon.im/)  
[Christmas Hues  
![](docs/img/hues_xmas.png)](https://xmas.moe/)

You can also have animations that sync perfectly with the beats of the songs. Inspired by Kepstin's Integral experiments.  
[420 Hues, Snoop Edition  
![](docs/img/hues_snoop.png)](https://420.mon.im/snoop.html)  
["Montegral"  
![](docs/img/hues_montegral.png)](https://0x40.mon.im/montegral.html)  
[More Cowbell  
![](docs/img/hues_cowbell.png)](https://0x40.mon.im/cowbell.html)

For some examples of **fast, complicated and fancy** maps, here are some of my personal creations:  
[Black Banshee - BIOS](https://0x40.mon.im/custom.html?packs=BIOS.zip)  
[Drop It](https://0x40.mon.im/custom.html?packs=drop_it.zip)  
[Atols - Eden (buildup only)](https://0x40.mon.im/custom.html?packs=eden.zip)  
[AAAA - Hop Step Adventure](https://0x40.mon.im/custom.html?packs=hopstep.zip)  
[MACROSS 82-99 - ミュン・ファン・ローン](https://0x40.mon.im/custom.html?packs=macross.zip)  
[MDK - Press Start (VIP Mix)](https://0x40.mon.im/custom.html?packs=press_start.zip)  
[Alex Centra - Roguebot [Inspected]](https://0x40.mon.im/custom.html?packs=roguebot.zip)  
[Elenne - Vertical Smoke](https://0x40.mon.im/custom.html?packs=smoke.zip)  
[Nicky Flower - Wii Shop Channel (Remix)](https://0x40.mon.im/custom.html?packs=wii_remix.zip)  
[Nhato - Logos](https://0x40.mon.im/custom.html?packs=logos.zip)  
[Massive New Krew - HADES](https://0x40.mon.im/custom.html?packs=HADES.zip)

Finally there's these, which hook into the Hues javascript events to do something fresh:  
[Doors](https://0x40.mon.im/doors.html)  
[Does Lewis Have A Girlfriend Yet (xox love ya)](https://0x40.mon.im/lewis.html)

## Creating your own songs

0x40 Hues comes with an integrated editor to create new songs and inspect existing ones.
[Read how to use it here](https://github.com/mon/0x40-web/blob/master/docs/Editor.md) - it's easier than you think!

## Editing respacks

There is an extremely basic respack editor at respack_edit.html. I also host it
on [my site](https://0x40.mon.im/respack_edit.html). It does not support adding
images, nor does it support adding songs. You can, however, edit all properties
of an existing respack's songs and images. If this is lacking features you would
like, please open a ticket. It was mostly made for editing centerPixel values.

## Install (Make your own Hues website)

1. Start by downloading the latest [release](https://github.com/mon/0x40-web/releases)
2. Put your respack zips somewhere they can be found by your web server. My hues have a `respacks/` folder under the main directory
3. Edit `index.html`:
4. Edit the `defaults` object so the `respacks` list contains the respacks you wish to load
5. _Optional:_ Add any extra settings to the `defaults` object
6. Upload everything to your server!

### Example settings

```javascript
var defaults = {
  respacks: ["./respacks/Defaults_v5.0_Opaque.zip", "./respacks/HuesMixA.zip"],
  firstSong: "Nhato - Miss You",
};
```

## Settings object

See [HuesSettings.ts](./src/js/HuesSettings.ts#L10) for the possible options you
can put into the `defaults` object.

## Query string

Any setting that can go in the `defaults` object can also be dynamically specified in the URL.
For example: https://0x40.mon.im/custom.html?packs=BIOS.zip,kitchen.zip&currentUI=v4.20

There are two special settings here:

- `firstSong` can just be written as `song`.
- Anything given as `packs` or `respacks` will be appended to the respacks
  specified in the `defaults` object, as opposed to overwriting them.

## Building

Install [Node.js](https://nodejs.org/en/). I currently use v18, but it should
work with newer releases.

Install the required packages for the build:

```bash
npm install
```

Build with `npx webpack`. It will create a `dist` folder. For seamless
development with auto-reload, `npx webpack serve` - if you do this, put any
respacks in `public/respacks` so they're found by the local server.

## Adding a new beat character

There's a few places to change, here's a list:

- The documentation in the INFO tab. Found in `HuesInfo.svelte`
- The mouseover documentation & button for the beat in EDITOR. Found in `HuesEditor/Main.svelte`
- The list of beats in `HuesCore.ts`
- If you've added some new display behaviour:
  - A new beat type in the `Effect` enum
  - A handler in the `beater` function
  - Appropriate state for the effect in `HuesRender.ts`
  - Appropriate rendering code in `HuesCanvas.ts`
