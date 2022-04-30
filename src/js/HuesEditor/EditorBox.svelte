<script>
    import HuesButton from '../Components/HuesButton.svelte';

    import { createEventDispatcher, tick } from 'svelte';

    const dispatch = createEventDispatcher();

    export let title;
    export let section;
    export let showHelp = false;
    export let newLineAtBeat;
    export let beatIndex;
    export let soundManager;

    export let editBox;
    export let header;

    let fileInput;
    let editDiv;

    export let locked = false;
    export let caret;

    let toggleLock = () => {
        locked = !locked;
    };

    $: valid = section && section.chart !== null;

    let oldLen;

    const getCaret = () => {
        // contenteditable is really quite cursed, and at this stage we might be
        // just after a paste - after which, the browser is totally free to have
        // inserted extra text nodes, <br>s, even <div>s. So we need to iterate
        // through all the children to get to our actual selection
        let caret = 0;
        const sel = window.getSelection();
        if (sel.rangeCount) {
          const range = sel.getRangeAt(0);
          for(let child of editDiv.childNodes) {
              if (range.commonAncestorContainer == child) {
                  caret += range.endOffset;
                return caret;
              } else {
                  caret += child.textContent.length;
              }
          }
        }
        return null;
    };

    export const setCaret = newCaret => {
        caret = Math.min(newCaret, section.chart.length);
        let sel = window.getSelection();
        // need to get the text out of the div
        const text = [...editDiv.childNodes].find(child => child.nodeType === Node.TEXT_NODE);
        // I mean this shouldn't ever fail, right?
        if(text !== null) {
            sel.collapse(text, caret);
        }
    }

    // we could fake the keyboard input with js... or just do this since we know
    // how we handle inputs
    export const fakeInput = async str => {
        saveLen(); // beforeinput
        section.chart = section.chart.slice(0, caret) + str + section.chart.slice(caret) // modify chart
        setCaret(caret + str.length); // handleInput expects the editor to have focus
        await handleInput();
    };

    let saveLen = () => {
        oldLen = section?.chart.length;
        dispatch('beforeinput');
    }

    const confirmLeave = () => "Unsaved beatmap - leave anyway?";

    let handleInput = async () => {
        if(section.chart.length == 0) {
            section.chart = '.';
        }

        caret = getCaret();

        const newLen = section.chart.length;
        if(locked && oldLen != newLen) {
            // by adding or removing as many extra characters as required,
            // starting from the caret, this even works for pastes
            if(newLen > oldLen) {
                // delete extra
                caret = Math.min(oldLen, caret);
                const extra = newLen - oldLen;
                section.chart = section.chart.slice(0, caret) + section.chart.slice(caret + extra);
            } else {
                // add extra
                const extra = '.'.repeat(oldLen - newLen);
                section.chart = section.chart.slice(0,caret) + extra + section.chart.slice(caret);
            }

            await tick();
            setCaret(caret);
        }

        window.onbeforeunload = confirmLeave;
        dispatch('afterinput');
    };

    const getCaretFromMouseEvent = event => {
        // We cannot just get the caret on the right click event, because in
        // Firefox, the first right click just focuses the textbox without
        // actually moving the caret. Only subsequent clicks will move it. So
        // instead, we get this hacky nonsense.

        // http://stackoverflow.com/a/10816667
        let el = event.target;
        let x = 0;
        let y = 0;

        while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
            x += el.offsetLeft - el.scrollLeft;
            y += el.offsetTop - el.scrollTop;
            el = el.offsetParent;
        }

        x = event.clientX - x;
        y = event.clientY - y;

        const fontWidth = editDiv.clientWidth / newLineAtBeat;
        const lines = Math.ceil(editDiv.textContent.length / newLineAtBeat);
        const fontHeight = editDiv.clientHeight / lines;

        x = Math.floor(x / fontWidth);
        y = Math.floor(y / fontHeight);

        return x + (y * newLineAtBeat);
    }

    let seek = event => {
        const off = getCaretFromMouseEvent(event);
        setCaret(off);
        dispatch('seek', off / section.chart.length);
        event.preventDefault();
    };

    let updateCaret = event => {
        const off = getCaret();
        if(off !== null) {
            caret = off;
        }
    }

    let banEnter = event => {
        if(event.keyCode == 13) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    // by default, the user can totally just copy formatted HTML straight into
    // the document... Block it and force plaintext
    let handlePaste = event => {
        // cancel paste
        event.preventDefault();

        // get text representation of clipboard
        let text = (event.originalEvent || event).clipboardData.getData('text/plain');

        // insert text manually
        // this is deprecated but keeps working and no alternative, so whatever
        document.execCommand("insertText", false, text);
    }

    let loadSong = async () => {
        if(fileInput.files.length < 1) {
            return;
        }

        let testSong;
        let file = fileInput.files[0];
        try {
            let buffer = await file.arrayBuffer();
            // Is this buffer even decodable?
            testSong = {sound: buffer};
            await soundManager.loadBuffer(testSong);
        } catch(err) {
            console.error(err);
            dispatch('error', "Couldn't load song! Is it a LAME encoded MP3?");
            return;
        }

        // if there isn't actually any song, force one to be created
        if(section === undefined) {
            dispatch('songnew');
            await tick();
        }

        // Save filename for XML export
        section.fname = file.name.replace(/\.[^/.]+$/, "");
        section.nameWithExt = file.name;
        // the original buffer is lost to the worker, so we take it from the song
        section.sound = testSong.sound;

        // make empty map if needed
        if(!section.chart) {
            section.chart = "x...o...x...o...";
        }

        dispatch('songload');
    }

    let removeSong = () => {
        section.chart = null;
        section.fname = null;
        section.nameWithExt = null;
        section.sound = null;

        dispatch('songremove');
    }

    let copyPretty = () => {
        // http://stackoverflow.com/a/27012001
        let regex = new RegExp("(.{" + newLineAtBeat + "})", "g");
        let text = section.chart.replace(regex, "$1\n");

        let textArea = document.createElement("textarea");
        textArea.className = "copybox";
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
</script>

<!-- So sibling editors that are linked can be modified together nicely -->
<svelte:options accessors/>

<!-- Must be 2 elements, else modify the grid definition in Main.svelte -->

<div class="header" bind:this={header}>
    <!-- Filthy width hacks to align labels -->
    <span style="min-width: 7ch;">{@html title}</span>
    <!-- |<< (seek back) -->
    <HuesButton icon disabled={!valid} on:click={() => dispatch("rewind")}>&#xe90b;</HuesButton>
    <span class="beat-count">{valid ? section.chart.length : 0} beats</span>
    <!-- Lock icon -->
    <HuesButton
        icon
        title="{locked ? "Unlock" : "Lock"} beat count"
        on:click={toggleLock}
        disabled={!valid}
    >
        {@html locked ? "&#xe906;" : "&#xe907;"}
    </HuesButton>
    <!-- Copy icon -->
    <HuesButton icon disabled={!valid} title="Copy formatted beatmap" on:click={() => copyPretty()}>&#xe90c;</HuesButton>

    <!-- spacer -->
    <div/>

    <HuesButton on:click={() => dispatch('halve')} disabled={!valid || locked || section.chart.length <= 1}>
        Halve
    </HuesButton>
    <HuesButton on:click={() => dispatch('double')} disabled={!valid || locked}>
        Double
    </HuesButton>
    <input
        type="file"
        style="display:none"
        bind:this={fileInput}
        accept=".mp3, .wav, .ogg"
        multiple=false
        on:change={loadSong}
    />
    <HuesButton on:click={() => fileInput.click()}>
        <!-- Filthy width hacks to align labels -->
        <div style="min-width: 12ch;">Load {title}</div>
    </HuesButton>
    <HuesButton on:click={removeSong} disabled={!valid}>Remove</HuesButton>
</div>

<div class="edit-box" bind:this={editBox}>
    {#if showHelp && !valid}
        <div class="beat-hilight">
Click [LOAD RHYTHM] to load a loop!
OGG,or LAME encoded MP3s work best.

You can also add a buildup with
[LOAD BUILDUP], or remove it with [REMOVE].

[NEW SONG] adds a totally empty song to edit.

[COPY/SAVE XML] allow for storing the rhythms
and easy inclusion into a Resource Pack!

Click [HELP] for advanced techniques and more
information.
        </div>
    {:else if !valid}
        <div class="beat-hilight">
            [none]
        </div>
    {:else if beatIndex !== null && beatIndex >= 0}
        <div class="beat-hilight" style="width:{newLineAtBeat}ch;">
            {@html ' '.repeat(beatIndex) + '&block;'}
        </div>
    {/if}
    {#if valid}
        <!-- Note the order of saveLen/bind/handleInput - it matters -->
        <div
            bind:this={editDiv}
            class="beatmap"
            contenteditable="true"
            spellcheck="false"
            style="width:{newLineAtBeat}ch;"
            on:keydown={banEnter}
            on:paste={handlePaste}
            on:input={saveLen}
            bind:textContent={section.chart}
            on:input={handleInput}
            on:contextmenu={seek}
            on:click={updateCaret}
            on:focus={() => dispatch('focus')}
        />
    {/if}
</div>

<style>
.header {
    grid-column: editors;

    display: grid;
    grid-template-columns: repeat(5, max-content) 1fr repeat(4, max-content);
    align-items: center;

    padding-bottom: 5px;
}

.beat-count {
    font-size: 10px;
    margin-left: 4px;
}

.edit-box {
    grid-column: editors;

    position: relative;
    overflow: auto;
    background-color: white;
    margin: auto 5px;
    height: 100%;
}

.edit-box > div {
    white-space: break-spaces;
    word-break: break-all;
    line-break: anywhere;
}

.beatmap {
    position: relative;
}

.beatmap:focus {
    outline-width: 0;
    outline: none;
}

.beat-hilight {
    position: absolute;
    color: rgba(127,127,127,0.8);
}
</style>
