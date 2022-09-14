<script lang="ts">
    import HuesButton from '../Components/HuesButton.svelte';
    import { HuesSongSection } from '../ResourcePack';
    import { HuesIcon } from '../HuesIcon';
    import type SoundManager from '../SoundManager';

    import { createEventDispatcher, tick } from 'svelte';

    const dispatch = createEventDispatcher();

    export let title: string;
    export let section: HuesSongSection | undefined;
    export let showHelp = false;
    export let newLineAtBeat: number;
    export let beatIndex: number | null;
    export let soundManager: SoundManager;

    export let editBox: HTMLDivElement | undefined = undefined;
    export let header: HTMLDivElement | undefined = undefined;

    let fileInput: HTMLInputElement;
    let editBanks: HTMLDivElement[] = [];

    export let locked = false;
    export let caret: number | undefined = undefined;
    export let hiddenBanks: boolean[] = [];
    let bankFocus = 0;
    let bankHover = 0;

    $: activeBanks = section?.banks
        .map((bank, i): [HTMLDivElement, number] => [editBanks[i], i])
        .filter((bankI, i) => !hiddenBanks[i]);

    let toggleLock = () => {
        locked = !locked;
    };

    let oldLen: number;

    const getCaret = () => {
        // contenteditable is really quite cursed, and at this stage we might be
        // just after a paste - after which, the browser is totally free to have
        // inserted extra text nodes, <br>s, even <div>s. So we need to iterate
        // through all the children to get to our actual selection
        let caret = 0;
        const sel = window.getSelection();
        if (sel?.rangeCount) {
          const range = sel.getRangeAt(0);
          for(let child of editBanks[bankFocus].childNodes) {
              if (range.commonAncestorContainer == child) {
                  caret += range.endOffset;
                return caret;
              } else {
                  caret += child.textContent?.length || 0;
              }
          }
        }
        return undefined;
    };

    export const setCaret = (newCaret: number, el?: HTMLDivElement) => {
        if(el === undefined) {
            el = editBanks[bankFocus];
        } else {
            bankFocus = editBanks.indexOf(el);
        }
        caret = Math.min(newCaret, section!.mapLen);
        let sel = window.getSelection();
        // need to get the text out of the div
        const text = [...el.childNodes].find(child => child.nodeType === Node.TEXT_NODE);
        // I mean this shouldn't ever fail, right?
        if(text && sel) {
            sel.collapse(text, caret);
        }
    }

    // we could fake the keyboard input with js... or just do this since we know
    // how we handle inputs
    export const fakeInput = async (str: string) => {
        saveLen(); // beforeinput

        let b = section!.banks[bankFocus];

        // if a range is selected, we need to delete the range first or the
        // caret is going to be wrong
        const sel = window.getSelection();
        if(sel?.rangeCount) {
            const range = sel.getRangeAt(0);
            const rLen = range.endOffset - range.startOffset;
            if(rLen > 1) {
                b = b.slice(0, range.startOffset) + b.slice(range.endOffset);
                caret = range.startOffset;
            }
        }

        section!.banks[bankFocus] = b.slice(0, caret) + str + b.slice(caret); // modify chart
        const newCaret = caret! + str.length;
        await tick();
        setCaret(newCaret); // handleInput expects the editor to have focus
        await handleInput();
    };

    let saveLen = () => {
        oldLen = section!.mapLen;
        dispatch('beforeinput');
    }

    const confirmLeave = () => "Unsaved beatmap - leave anyway?";

    let deleteAtCaret = (bank: number, count: number, caret: number) => {
        const b = section!.banks[bank];
        section!.banks[bank] = b.slice(0, caret) + b.slice(caret! + count);
    }

    let insertAtCaret = (bank: number, count: number, caret: number) => {
        const b = section!.banks[bank];
        const extra = '.'.repeat(count);
        section!.banks[bank] = b.slice(0,caret) + extra + b.slice(caret);
    }

    let matchLenAtCaret = (bank: number, need: number, caret: number) => {
        const have = section!.banks[bank].length;
        if(have < need) {
            insertAtCaret(bank, need - have, caret);
        } else if(need < have) {
            deleteAtCaret(bank, have - need, caret);
        }
    }

    let handleInput = async () => {
        caret = getCaret();

        const newLen = section!.banks[bankFocus].length;
        if(locked && oldLen != newLen && caret !== undefined) {
            // by adding or removing as many extra characters as required,
            // starting from the caret, this even works for pastes
            if(newLen > oldLen) {
                // delete extra
                caret = Math.min(oldLen, caret);
                deleteAtCaret(bankFocus, newLen - oldLen, caret);
            } else {
                // add extra
                insertAtCaret(bankFocus, oldLen - newLen, caret);
            }

            await tick();
            setCaret(caret);
        } else if(!locked && oldLen != newLen && caret !== undefined) {
            // extend/shrink any other banks as required at the insertion caret
            for(let i = 0; i < section!.banks.length; i++) {
                if(i == bankFocus) {
                    continue;
                }

                if(newLen > oldLen) {
                    matchLenAtCaret(i, newLen, Math.max(0, caret - (newLen - oldLen)));
                } else {
                    matchLenAtCaret(i, newLen, Math.max(0, caret));
                }
            }
        }

        window.onbeforeunload = confirmLeave;
        dispatch('afterinput');
    };

    const getCaretFromMouseEvent = (event: MouseEvent): [number, HTMLDivElement?] => {
        // We cannot just get the caret on the right click event, because in
        // Firefox, the first right click just focuses the textbox without
        // actually moving the caret. Only subsequent clicks will move it. So
        // instead, we get this hacky nonsense.

        // Also, for multi-bank, the divs all fight for focus (and the top one
        // always wins), so this is required.

        // for all but the hover event, at least 1 bank is active and valid,
        // because otherwise the events wouldn't arrive at all. So we check just
        // for this.
        if(!activeBanks?.length) {
            return [0, undefined];
        }

        // http://stackoverflow.com/a/10816667
        // find where the cursor is relative to the editBox
        //let el = event.target as HTMLElement;
        let el = editBox as HTMLElement;
        let x = 0;
        let y = 0;

        while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
            x += el.offsetLeft - el.scrollLeft;
            y += el.offsetTop - el.scrollTop;
            el = el.offsetParent as HTMLElement;
        }

        x = event.clientX - x;
        y = event.clientY - y;

        const fontWidth = activeBanks![0][0].clientWidth / newLineAtBeat;
        const bankCount = activeBanks!.length;
        const lines = Math.ceil(section!.mapLen / newLineAtBeat) * bankCount;
        const fontHeight = activeBanks![0][0].clientHeight / lines;

        x = Math.floor(x / fontWidth);
        y = Math.floor(y / fontHeight);

        let targetEl = activeBanks![y % bankCount][0];
        y = Math.floor(y / bankCount);

        return [x + (y * newLineAtBeat), targetEl];
    }

    let seek = (event: MouseEvent) => {
        const [off, el] = getCaretFromMouseEvent(event);
        setCaret(off, el);
        dispatch('seek', off / section!.mapLen);
        event.preventDefault();
    };

    let click = (event: MouseEvent) => {
        const [off, el] = getCaretFromMouseEvent(event);
        caret = off;

        bankFocus = editBanks.indexOf(el!);

        event.stopPropagation();
    }

    let hover = (event: MouseEvent) => {
        const [off, el] = getCaretFromMouseEvent(event);
        if(el !== undefined) {
            bankHover = editBanks.indexOf(el);
        }
    }

    let banEnter = (event: KeyboardEvent) => {
        // block "return" - keyCode is more reliable here I can't remember the deets
        if(event.keyCode == 13) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    let handleArrows = (event: KeyboardEvent) => {
        if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
            const off = getCaret();
            if(off !== undefined) {
                caret = off;
            }
        }
    };

    // by default, the user can totally just copy formatted HTML straight into
    // the document... Block it and force plaintext
    let handlePaste = (event: ClipboardEvent) => {
        // cancel paste
        event.preventDefault();
        event.stopPropagation();

        // get text representation of clipboard
        let text = event.clipboardData?.getData('text/plain');

        if(text) {
            // remove newlines
            text = text.replace(/[\n\r]/g, "");
            // insert text manually
            fakeInput(text);
        }
    }

    let loadSong = async () => {
        if(!fileInput.files || fileInput.files.length < 1) {
            return;
        }

        let testSong;
        let file = fileInput.files[0];
        try {
            let buffer = await file.arrayBuffer();
            // Is this buffer even decodable?
            testSong = new HuesSongSection(undefined, buffer);
            await soundManager.loadBuffer(testSong);
        } catch(err) {
            console.error(err);
            dispatch('error', "Couldn't load song! Is it a LAME encoded MP3?");
            return;
        }

        // if there isn't actually any song, force one to be created
        let newSection;
        if(section === undefined) {
            newSection = new HuesSongSection();
            // editor-created charts are a little more vibrant
            newSection.banks = ["x...o...x...o..."];
        } else {
            newSection = section;
        }

        // Save filename for XML export
        newSection.filename = file.name;
        // the original buffer is lost to the worker, so we take it from the song
        newSection.sound = testSong.sound;

        dispatch('songload', newSection);
    }

    let removeSong = () => {
        section!.banks = ['.'];
        section!.filename = undefined;
        section!.sound = undefined;

        dispatch('songremove');
    }

    let copyPretty = () => {
        // TODO: copy all banks?
        // http://stackoverflow.com/a/27012001
        let regex = new RegExp("(.{" + newLineAtBeat + "})", "g");
        let text = section!.banks[bankFocus].replace(regex, "$1\n");

        let textArea = document.createElement("textarea");
        textArea.className = "copybox";
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }

    $: styleForMap = (i: number) => {
        // the crazy top calc is because the char is centered in the line-height
        return `width:${newLineAtBeat}ch; top: calc(-${activeBanks!.length-1}ch/2 + ${i}ch); line-height: ${activeBanks!.length}ch;`;
    }
</script>

<!-- So sibling editors that are linked can be modified together nicely -->
<svelte:options accessors/>

<!-- Must be 2 elements, else modify the grid definition in Main.svelte -->

<div class="header" bind:this={header}>
    <!-- Filthy width hacks to align labels -->
    <span style="min-width: 7ch;">{@html title}</span>
    <!-- |<< (seek back) -->
    <HuesButton icon disabled={!section?.sound} on:click={() => dispatch("rewind")}>{@html HuesIcon.REWIND}</HuesButton>
    <span class="beat-count">{section ? section.mapLen : 0} beats</span>
    <!-- Lock icon -->
    <HuesButton
        icon
        title="{locked ? "Unlock" : "Lock"} beat count"
        on:click={toggleLock}
        disabled={!section?.sound}
    >
        {@html locked ? HuesIcon.LOCKED : HuesIcon.UNLOCKED}
    </HuesButton>
    <!-- Copy icon -->
    <HuesButton icon disabled={!section?.sound} title="Copy formatted beatmap" on:click={() => copyPretty()}>{@html HuesIcon.COPY}</HuesButton>

    <!-- spacer -->
    <div/>

    <HuesButton on:click={() => dispatch('halve')} disabled={!section?.sound || locked || section.mapLen <= 1}>
        Halve
    </HuesButton>
    <HuesButton on:click={() => dispatch('double')} disabled={!section?.sound || locked}>
        Double
    </HuesButton>
    <input
        type="file"
        style="display:none"
        bind:this={fileInput}
        accept=".mp3, .wav, .ogg, .opus"
        on:change={loadSong}
    />
    <HuesButton on:click={() => fileInput.click()}>
        <!-- Filthy width hacks to align labels -->
        <div style="min-width: 12ch;">Load {title}</div>
    </HuesButton>
    <HuesButton on:click={removeSong} disabled={!section?.sound}>Remove</HuesButton>
</div>

<div class="edit-box" bind:this={editBox} on:mousemove={hover}>
    {#if showHelp && !section?.sound}
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
    {:else if !section?.sound}
        <div class="beat-hilight">
            [none]
        </div>
    <!-- don't need `&& activeBanks` but type checker can't unravel it -->
    {:else if beatIndex !== null && beatIndex >= 0 && activeBanks}
        {#each activeBanks as _, i}
            <div class="beat-hilight" style="{styleForMap(i)}">
                {@html ' '.repeat(beatIndex) + '&block;'}
            </div>
        {/each}
    {/if}
    {#if section?.sound && activeBanks}
        {#if activeBanks.length > 1}
            <!-- This should be as simple as a background-color, but it selects the
                entire bounding box instead of just the text itself, and using a
                span breaks the text wrapping -->
            <div class="beat-focus" style="{styleForMap(bankFocus)}">
                {@html '&block;'.repeat(section.mapLen)}
            </div>
        {/if}
        <!-- Note the order of saveLen/bind/handleInput - it matters -->
        {#each activeBanks as [_, bankI], i}
            <div
                bind:this={editBanks[bankI]}
                class:underline={activeBanks.length > 1 && i == activeBanks.length - 1}
                class:hover={bankI == bankHover}
                contenteditable
                spellcheck="false"
                class="beatmap"
                style="{styleForMap(i)}"
                on:keydown={banEnter}
                on:keyup={handleArrows}
                on:paste={handlePaste}
                on:input={saveLen}
                bind:textContent={section.banks[bankI]}
                on:input={handleInput}
                on:contextmenu={seek}
                on:mousedown={click}
                on:click={click}
                on:focus={() => dispatch('focus')}
            />
        {/each}
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

@media (max-width: 710px) {
    .header {
        display: flex;
        flex-wrap: wrap;
    }
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
    position: absolute;
    pointer-events: none;
}

.beatmap:focus {
    outline-width: 0;
    outline: none;
}

.beatmap.hover {
    pointer-events: inherit;
}

.beat-focus {
    position: absolute;
    color: rgba(127,127,127,0.2);
}

.beat-hilight {
    overflow-anchor: none;
    position: absolute;
    color: rgba(127,127,127,0.8);
}

.underline {
    text-decoration: underline;
}
</style>
