# Resource Packs  
Resource Packs (respacks) are what makes Hues tick. They contain the songs and images that are played when it is loaded.

It helps to examine a pre-existing respack to understand how they work. There are several available on the [0x40 Hues Blogspot](http://0x40hues.blogspot.com/p/blog-page_5.html).

Respacks are a simple .zip file and contain .xml files for information, and image and music files to be loaded. Folders and locations do not matter, but it can help to organise your respacks so that images, animated images and songs are in separate folders, and information xml files are in the top level.

## info.xml  
An info.xml file provides information about who made the respack, a brief description, and a link.

An example structure is as follows:  
```xml
<info>
	<name>My Awesome Respack</name>
	<author>Me!</author>
	<description>I made song songs, and put them in a respack</description>
	<link>http://www.example.com/</link>
</info>
```

The options should be fairly self explanatory. Respack names are printed to console on load, and other respack information is visible in the Respacks tab.

## Images and images.xml  
*An images.xml file is not mandatory*. Simply putting images into your respack is enough to get them loaded. However, if you want to do something fancy, such as aligning an image to a certain side of the screen, you will need to create an `images.xml` file.

An example structure is as follows:  
```xml
<images>
    <image name="Image1">
        <align>right</align>
    </image>
    <image name="Animation">
        <fullname>My Cool Animation</fullname>
        <frameDuration>45</frameDuration>
    </image>
</images>

```

Each `image` element must have a `name`. This refers to the filename (minus extension) of the image we are talking about.

Possible options for images are:

Name | Options | Default | Description
--- | --- | --- | --- 
fullname | Any text | The image filename | If you would like a longer name than your file, specify one here. Some UIs display the longer name, some display the shorter name.
align | `left`, `right`, `center` | `center` | If the "Smart align images" option is set, the image will be aligned to the specified side of the screen.
source | Any link | None | If you would like to provide a link to where you found the image, put one here. It will be clickable in the UI

### Animations  
Animations are a special class of image. Because of limitations with using either gifs or videos, animations must be individual frames saved in the respack. The name of animated files must be `Name_x.ext` where `x` is the frame number and `ext` is png/jpg etc.

Additional options for animations are:

Name | Options | Default | Description
--- | --- | --- | --- 
frameDuration | Comma separated numbers, eg `33,45,20`| `33` | How long (in ms) each frame will display. Each frame can have a different length. If there are more listed durations than frames, they are ignored. If there are fewer listed durations than frames, the last duration is reused for any extra frames. For example, if every frame is 40ms long, just use `40`.
beatsPerAnim (**web Hues only**) | Any number | None | For synchronising animations to songs. Sets how many beats a single loop of this animation runs for. If the currently playing song has a matching `charsPerBeat` setting, the animation will be synchronised. Otherwise, it will fall back to the `frameDuration` set.
syncOffset (**web Hues only**) | Any number | `0` | If the "beat" of your synchronised animation does not occur on frame 1, use this value to shift it.


## Songs and songs.xml  
If your respack contains songs, *a songs.xml file is mandatory*.

Here is an example song structure:  
```xml
<songs>
  <song name="puppy_loop">
    <title>Netsky - Puppy</title>
	<source>http://www.youtube.com/watch?v=FU4cnelEdi4</source>
    <rhythm>o...x...o...x...o...x...o...</rhythm>
    <buildup>puppy_build</buildup>
    <buildupRhythm>.-...:......:...-...</buildupRhythm>
    <charsPerBeat>4</charsPerBeat>
  </song>
  <song name="motion picture">
	<title>Blake McGrath- Motion Picture (Pegboard Nerds Remix)</title>
	<rhythm>o...x...o...</rhythm>
	<buildup>motion picture_Build</buildup>
	<buildupRhythm>-...-...-...-...-...</buildupRhythm>
    <independentBuild>true</independentBuild>
  </song>
</songs>
```

Like `image` elements, each `song` element must have a `name`. This refers to the filename of the loop, minus extension.

The [editor](Editor.md) can export song XML data. It is recommended you use it to avoid making spelling or formatting mistakes when doing it manually.

Possible options for songs are:

Name | Options | Default | Description
--- | --- | --- | --- 
title | Any text | `<no name>` | The full name of the song
source | Any text | None | The source URL of the song, clickable in the UI
rhythm (**required**) | Any text | None | The beatmap of the song. Create one in the [editor](Editor.md).
buildup | Filename minus extension | None | The filename of the buildup - the lead-in to the main loop.
buildupRhythm | Any text | `.` for the entire build | A rhythm for the buildup, if any.
independentBuild (**web Hues only**) | Anything | None | By default, the length of a buildup is set so the buildup beatmap runs at the same speed as the main loop. If this is set, the buildup's beatmap can be any length, and will run faster or slower than the main loop. Best set using the [editor](Editor.md).
charsPerBeat (**web Hues only**) | Any number | None | For synchronising animations. Specifies how many characters of the beatmap make up a beat in the song. If an animation is playing and has a matching `beatsPerAnim` setting, the animation will be synchronised.
