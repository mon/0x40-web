# Beatmap Editor

Creating new songs is the heart of the Hues experience. The inbuilt editor makes
it a breeze! To get to it, either hit your `e` key or click the settings cog,
then hit `EDITOR`.

Before you begin, you'll actually need a song to edit! You might be able to find
good loops online, or you can make your own from a song you enjoy. The best way
to make your own is using Audacity, detailed in the [MP3
guide](MP3%20Export.md).

1. Load your loop using the `LOAD LOOP` button. If everything went well, it
   should start playing.
2. In the `Title` box, enter the Artist - Song Name combination, e.g. "Madeon -
   Finale" (without quotes)
3. Enter a source into the `Source` box if you have it - if you share your loop,
   it's nice to give other people a link to a high quality original.

Now your loop is playing! Adjust time with the `HALVE` and `DOUBLE` buttons
until the loop's beats match up with your beatmap. If you're happy with it, you
can click the lock icon next to the beat count, and entered beats will override
previous beats instead of adding to the total.

From here, you can edit the rhythm. Check the Beat Glossary on the `INFO` tab to
see what characters you can use.

A good way to start is lining up the bass or snare hits before moving on to
another instrument, rather than trying to do everything at once. If you find
yourself needing more space for notes, you can always use `DOUBLE`.

Once you've made your loop, you can optionally add a Buildup and repeat the
process to edit its map.

When you're finished, **don't forget** to copy or save the XML to save your
work! You can then put your song into a [respack](Respacks.md) and share it!

### Banks
For more complicated mapping, you may want to start combining effects in new and
exciting ways! For that, use Banks. Every map has at least one bank, and you can
add as many as you want. The beatmap visualiser will look at each bank in
sequence and apply all the effects it sees.

The most useful way to use banks is to change the way time based effects work.
For example, a colour fade will fade until the next beat character. If you want
to have a fade running at the same time as blurs, you can use Bank 1 to perform
the fade, and Bank 2 to perform the blurs - the time calculations only take into
account characters in the bank they start in.

### Editing tips  
- **Right click on the beatmap to seek** to that position. Don't wait until the
  song repeats!
- Use the buttons at the bottom left to slow the song down and make tricky
  sections easier to map.
- Rewind to the start of the song or the start of the buildup with the arrows
  next to the `Buildup` and `Rhythm` labels.
- If you need more room to edit a part, resize it with the handle in between the
  sections.
- If your song isn't in 4/4 time, try changing the `New line at beat` setting so
  your bars line up.
- Use the beat buttons at the bottom of the editor to input non-typeable
  characters like `→` or `¤`.

One last advanced tip - if your buildup is crazy different from your rhythm and
is proving hard to map, click the chain icon on the left to unlink the 2
sections. **Your song will no longer be compatible with the flash** but the
buildup and rhythm can have separate map lengths. Let your creativity go nuts!

*This tutorial heavily based on [the original](http://0x40hues.blogspot.com/p/0x40-hues-creation-tutorial.html).*
