<script lang="ts">
    import HuesButton from '../Components/HuesButton.svelte';
    import EditorBox from './EditorBox.svelte';
    import InputBox from './InputBox.svelte';
    import SongStat from './SongStats.svelte';
    import Timelock from './Timelock.svelte';
    import Waveform from './Waveform.svelte';

    import { tick, onMount, createEventDispatcher } from 'svelte';

    import type SoundManager from '../SoundManager';
    import type { HuesSongSection } from '../ResourcePack';
    import type { EditorUndoRedo } from '../HuesEditor';
    import { HuesIcon } from '../HuesIcon';

    export let soundManager: SoundManager;
    export let huesRoot: HTMLElement; // required for size calculations

    export let beatIndex = 0;

    // because the editor takes a little CPU time, block it off til the user
    // clicks a "hey let's try this" button
    export let totallyDisabled = true;
    // if song is null
    export let disabled = true;

    // mirrored props from the song object, to make binding/events work nicely
    export let independentBuild: boolean = false;
    export let title: string = "";
    export let source: string = "";
    export let loop: HuesSongSection | undefined = undefined;
    export let build: HuesSongSection | undefined = undefined;
    export let undoQueue: EditorUndoRedo[] = [];
    export let redoQueue: EditorUndoRedo[] = [];
    export let hiddenBanks: boolean[] = [];
    export let songLoadPromise: Promise<void> = Promise.reject();
    export let locked: boolean = false; // link these together

    // and until we convert the rest of the app to svelte, this lets consumers
    // update their own state more simply
    const dispatch = createEventDispatcher();
    $: {
        dispatch('update', {
            independentBuild: independentBuild,
            title: title,
            source: source,
            loop: loop,
            build: build,
            hiddenBanks: hiddenBanks,
        })
    };

    const MAX_UNDO = 200;

    // very slightly different to HuesInfo - does not combine shutter etc into a
    // single line
    const beatGlossary = [
        ["x", "Vertical blur"],
        ["o", "Horizontal blur"],
        ["-", "Change image"],
        ["+", "Blackout"],
        ["¤", "Whiteout"],
        ["|", "Short blackout"],
        ["!", "Short whiteout"],
        [":", "Color only"],
        ["*", "Image only"],
        ["X", "Vertical blur only"],
        ["O", "Horizontal blur only"],
        [")", "Trippy cirle in and change image"],
        ["(", "Trippy circle out and change image"],
        [">", "Trippy cirle in"],
        ["<", "Trippy circle out"],
        ["~", "Fade color"],
        ["=", "Fade and change image"],
        ["i", "Invert all colours"],
        ["I", "Invert & change image"],
        ["s", "Horizontal slice"],
        ["S", "Horizontal slice and change image"],
        ["v", "Vertical slice"],
        ["V", "Vertical slice and change image"],
        ["#", "Double slice"],
        ["@", "Double slice and change image"],
        ["←", "Shutter left"],
        ["↓", "Shutter down"],
        ["↑", "Shutter up"],
        ["→", "Shutter right"],
        ["_", "Stop timed effects"],
        ["¯", "Stop all effects"],
    ];

    let editor: HTMLDivElement;
    let editArea: HTMLDivElement;
    let buildupEditBox: HTMLDivElement;
    let loopEditBox: HTMLDivElement;
    let loopHeader: HTMLDivElement;
    let resizeHandle: HTMLDivElement;

    let buildEditorComponent: EditorBox;
    let loopEditorComponent: EditorBox;
    let editorFocus: EditorBox | null = null;

    let helpGlow = true;

    let statusMsg = "";
    let statusAnim = false;

    $: buildIndex = (beatIndex < 0 && build) ? build.mapLen + beatIndex : null;
    $: loopIndex = beatIndex >= 0 ? beatIndex : null;
    $: loopLen = loop ? loop.mapLen : NaN;
    $: hasBoth = build && loop;
    $: editorFocussed = editorFocus !== null;

    let newLineAtBeat = 32;
    let playbackRate = 1.0;

    export const alert = (msg: string) => {
        statusMsg = msg;
        // recreate the div, even if the message didn't change content
        statusAnim = !statusAnim;
    };

    // all the undo/redo stuff only initialises if it needs to, hence checking
    // if the queue is even defined yet
    const applyUndoRedo = async (props: EditorUndoRedo | undefined) => {
        // shouldn't happen but anyway...
        if(props === undefined) {
            return;
        }

        // if you start saving more props, add them here
        if(build && props.builds) {
            build.banks = props.builds;
        }
        if(loop && props.loops) {
            loop.banks = props.loops;
        }

        independentBuild = props.independentBuild;
        if(props.caret !== undefined) {
            await tick();
            props.editor?.setCaret(props.caret);
        }
    };

    const undoRedoSnapshot = (): EditorUndoRedo => {
        let ret: EditorUndoRedo = {
            independentBuild: independentBuild,
        };

        if(build) {
            ret.builds = [...build.banks];
        }
        if(loop) {
            ret.loops = [...loop.banks];
        }

        return ret;
    }

    const undo = () => {
        if(!redoQueue) {
            redoQueue = [];
        }

        redoQueue.push(undoRedoSnapshot());

        applyUndoRedo(undoQueue.pop());

        undoQueue = undoQueue;
        redoQueue = redoQueue;
    };

    const redo = () => {
        undoQueue.push(undoRedoSnapshot());

        applyUndoRedo(redoQueue.pop());

        undoQueue = undoQueue;
        redoQueue = redoQueue;
    };

    const pushUndo = (extraProps?: Partial<EditorUndoRedo>) => {
        if(!undoQueue) {
            undoQueue = [];
        }
        redoQueue = [];

        let props = undoRedoSnapshot();
        if(extraProps) {
            Object.assign(props, extraProps);
        }

        undoQueue.push(props);
        while(undoQueue.length > MAX_UNDO) {
            undoQueue.shift();
        }

        undoQueue = undoQueue;
    };

    const soundLen = (editor: EditorBox) => {
        if(editor == buildEditorComponent) {
            return soundManager.build.length;
        } else {
            return soundManager.loop.length;
        }
    };

    const otherEditor = (oneEditor: EditorBox) => {
        return oneEditor == buildEditorComponent ? loopEditorComponent : buildEditorComponent;
    };

    // subtract or add '.' until the child is the same beat ratio as the parent
    const resyncEditorLengths = (parent: EditorBox) => {
        parent.section?.recalcBeatString();

        if(independentBuild || !hasBoth) {
            return;
        }

        let child = otherEditor(parent);

        let changed = false;
        for(let i = 0; i < parent.section!.banks.length; i++) {
            const secPerBeat = soundLen(parent) / parent.section!.banks[i].length;
            let childBeats = Math.round(soundLen(child) / secPerBeat);
            // charts must have at least 1 character
            childBeats = Math.max(childBeats, 1);
            if(childBeats > child.section!.banks[i].length) {
                const extra = childBeats - child.section!.banks[i].length;
                child.section!.banks[i] += '.'.repeat(extra);
                changed = true;
            } else if(childBeats < child.section!.banks[i].length) {
                child.section!.banks[i] = child.section!.banks[i].slice(0, childBeats);
                changed = true;
            }
        }

        if(!changed) {
            return; // no change needed after all
        }

        child.section!.recalcBeatString();
        child.section = child.section; // inform of changed data
    };

    const doubleBeats = (editor: EditorBox) => {
        for(let i = 0; i < editor.section!.banks.length; i++) {
            editor.section!.banks[i] = editor.section!.banks[i]!.replace(/(.)/g, "$1.");
        }
        editor.section = editor.section; // inform of data change
    }
    const halveBeats = (editor: EditorBox) => {
        for(let i = 0; i < editor.section!.banks.length; i++) {
            let ret = editor.section!.banks[i].replace(/(.)./g, "$1");
            // don't allow an empty map
            if(!ret) {
                ret = '.';
            }
            editor.section!.banks[i] = ret;
        }
        editor.section = editor.section; // inform of data change
    }

    const halveDouble = (parent: EditorBox, apply: (e:EditorBox) => void) => {
        pushUndo();

        apply(parent);
        if(!independentBuild && hasBoth) {
            apply(otherEditor(parent));
            resyncEditorLengths(parent);
        } else {
            // still need to do this regardless
            parent.section?.recalcBeatString();
            otherEditor(parent).section?.recalcBeatString();
        }
    };

    // not arrow functions - need `this`
    function doubleClicked(this: EditorBox) {
        halveDouble(this, doubleBeats);
    }
    function halveClicked(this: EditorBox) {
        halveDouble(this, halveBeats);
    }

    function editorBeforeInput(this: EditorBox) {
        pushUndo({
            caret: this.caret,
            editor: this,
        });
    }

    function editorAfterInput(this: EditorBox) {
        resyncEditorLengths(this);
    }

    export const resyncEditors = () => {
        resyncEditorLengths(loopEditorComponent);
    }

    // originally onfocusout was also handled to disable the input buttons when
    // focus was lost, but
    // a) this also happens on browser defocus, you might have another window
    //    open and genuinely be wanting input + focus at the same time
    // b) the defocus event fires before the buttons get disabled, and it's
    //    kinda difficult to fix that timing
    function editorOnfocus(this: EditorBox) {
        editorFocus = this;
    }

    const changeRate = (change: number) => {
        let rate = soundManager.playbackRate;
        rate += change;
        soundManager.setRate(rate);
        // In case it gets clamped, check
        playbackRate = soundManager.playbackRate;
    }

    // unlike all the other info tabs, we want the editor to *grow* to fit
    // all the available space, instead of being the minimum possible size.
    let resize = () => {
        editor.style.height = (huesRoot.clientHeight - 250) + 'px';
    };

    onMount(resize);

    const resizeMousedown = (e: MouseEvent) => {
        e.preventDefault();

        let handleSize = resizeHandle.clientHeight;
        let handleMin = buildupEditBox.getBoundingClientRect().top + handleSize/2;
        let handleMax = loopEditBox.getBoundingClientRect().bottom - loopHeader.clientHeight - handleSize/2;
        let handleRange = handleMax - handleMin;

        let resizer = (e: MouseEvent) => {
            let clamped = Math.max(handleMin, Math.min(handleMax, e.clientY));
            let percent = (clamped - handleMin) / handleRange;

            editArea.style.setProperty('--buildup-ratio', percent + "fr");
            editArea.style.setProperty('--rhythm-ratio', (1 - percent) + "fr");
        };

        let mouseup = () => {
            document.removeEventListener("mousemove", resizer);
            document.removeEventListener("mouseup", mouseup);
        };

        document.addEventListener("mousemove", resizer);
        document.addEventListener("mouseup", mouseup);
    };

    const keydown = (event: KeyboardEvent) => {
        if(!event.ctrlKey) {
            return;
        }

        if(event.key == 'z') {
            undo();
        } else if(event.key == 'y') {
            redo();
        } else {
            return;
        }

        event.preventDefault();
    };
</script>

<svelte:window on:resize={resize} on:keydown={keydown}/>

<div class="editor" bind:this={editor}>
{#if totallyDisabled}
    <!-- swallow the error we deliberately make so it doesn't appear in the
         console -->
    {#await songLoadPromise catch}<div style="display:none;"/>{/await}

    <div class="editor-gate">
        <div>Ready to go?</div>
        <HuesButton on:click={() => {totallyDisabled = false}}>
            <span class="editor-gate-button">Activate Editor</span>
        </HuesButton>
    </div>
{:else}
    <!-- Header buttons -->
    <div class="title-buttons">
        <HuesButton on:click={() => dispatch('songnew')}>New Song</HuesButton>
        <HuesButton on:click={() => dispatch('savezip')} {disabled}>Save ZIP</HuesButton>
        <HuesButton on:click={() => dispatch('savexml')} {disabled}>Save XML</HuesButton>
        <HuesButton on:click={() => dispatch('copyxml')} {disabled}>Copy XML</HuesButton>
        <HuesButton on:click={() => undo()} disabled={!undoQueue || !undoQueue.length}>Undo</HuesButton>
        <HuesButton on:click={() => redo()} disabled={!redoQueue || !redoQueue.length}>Redo</HuesButton>
        <HuesButton glow="{helpGlow}" on:click={() => helpGlow = false}>
            <a href="https://github.com/mon/0x40-web/tree/master/docs/Editor.md" target="_blank">Help?</a>
        </HuesButton>

        {#key statusAnim}
        <span class="status-msg">{statusMsg}</span>
        {/key}
    </div>

    <div class="top-bar">
        <!-- Metadata -->
        <div class="info">
            <InputBox bind:value={title} label="Title:" placeholder="Song name" {disabled}/>
            <InputBox bind:value={source} label="Link:"  placeholder="Source link (YouTube, Soundcloud, etc)" {disabled}/>
        </div>

        <!-- Calculated data -->
        <div class="settings-individual song-stats">
            <!-- There is probably a nicer way to achieve this... -->
            {#await songLoadPromise}
                <SongStat label="Loop" unit="s" value="..."/>
                <SongStat label="Build" unit="s"  value="..."/>
                <SongStat label="Beats" unit="ms"  value="..."/>
                <SongStat label="" unit="bpm" value="..."/>
            {:then}
                <SongStat label="Loop" unit="s" value="{soundManager.loop.length.toFixed(2)}"/>
                <SongStat label="Build" unit="s"  value="{soundManager.build.length.toFixed(2)}"/>
                <SongStat label="Beats" unit="ms"  value="{((soundManager.loop.length / loopLen) * 1000).toFixed(2)}"/>
                <SongStat label="" unit="bpm" value="{(60 / (soundManager.loop.length / loopLen)).toFixed(2)}"/>
            {:catch}
                <SongStat label="Loop" unit="s" value="???"/>
                <SongStat label="Build" unit="s"  value="???"/>
                <SongStat label="Beats" unit="ms"  value="???"/>
                <SongStat label="" unit="bpm" value="???"/>
            {/await}
        </div>
    </div>

    <hr/>

    <!-- Editor zone -->
    <div class="edit-area" bind:this={editArea}>
        <Timelock
            bind:unlocked={independentBuild}
            on:click={() => {pushUndo(); resyncEditorLengths(loopEditorComponent);}}
            disabled={!hasBoth}
        />

        <div class="banks">
            <div class="banks-span-both">BANKS</div>
            {#if loop}
            {#each loop.banks as bank, i}
            <HuesButton
                nopad title="Toggle bank visibility"
                on:click={() => {hiddenBanks[i] = !hiddenBanks[i]}}>
                {i+1} <span class="hues-icon">{@html hiddenBanks[i] ? HuesIcon.EYE_CLOSED : '&emsp;'}</span>
            </HuesButton>
            {#if loop.banks.length == 1}
                <div></div>
            {:else}
                <HuesButton
                    nopad nouppercase title="Remove bank"
                    on:click={() => {pushUndo(); dispatch('removebank', i)}}>
                    x
                </HuesButton>
            {/if}
            {/each}
            {/if}
            <div class="banks-span-both">
                <HuesButton
                    title="Add bank"
                    on:click={() => {pushUndo(); dispatch('addbank')}}>
                    +
                </HuesButton>
            </div>
        </div>

        <EditorBox
            title="Buildup"
            bind:this={buildEditorComponent}
            bind:section={build}
            bind:editBox={buildupEditBox}
            bind:locked={locked}
            on:rewind={() => soundManager.seek(-soundManager.build.length)}
            on:seek={event => soundManager.seek(-soundManager.build.length * (1 - event.detail))}
            on:error={event => alert(event.detail)}
            on:songload={event => dispatch('loadbuildup', event.detail)}
            on:double={doubleClicked}
            on:halve={halveClicked}
            on:beforeinput={editorBeforeInput}
            on:afterinput={editorAfterInput}
            on:focus={editorOnfocus}
            on:songremove={event => dispatch('removebuildup')}
            on:songnew
            beatIndex={buildIndex}
            {newLineAtBeat}
            {soundManager}
            {hiddenBanks}
        />

        <div title="Resize" class="resize-handle" on:mousedown={resizeMousedown} bind:this={resizeHandle}>
            <!-- MENU looks like a drag handle when wide enough -->
            <div class="hues-icon handle">{@html HuesIcon.MENU}</div>
        </div>

        <EditorBox
            title="Rhythm"
            showHelp
            bind:this={loopEditorComponent}
            bind:section={loop}
            bind:header={loopHeader}
            bind:editBox={loopEditBox}
            bind:locked={locked}
            on:rewind={() => soundManager.seek(0)}
            on:seek={event => soundManager.seek(soundManager.loop.length * event.detail)}
            on:error={event => alert(event.detail)}
            on:songload={event => dispatch('loadrhythm', event.detail)}
            on:double={doubleClicked}
            on:halve={halveClicked}
            on:beforeinput={editorBeforeInput}
            on:afterinput={editorAfterInput}
            on:focus={editorOnfocus}
            on:songremove={event => dispatch('removerhythm')}
            on:songnew
            beatIndex={loopIndex}
            {newLineAtBeat}
            {soundManager}
            {hiddenBanks}
        />

        <!-- Beat inserter buttons -->
        <div class="beats">
            {#each beatGlossary as beat}
                <HuesButton
                    title="{beat[1]}"
                    on:click={() => {if(editorFocus) editorFocus.fakeInput(beat[0])}}
                    nouppercase
                    disabled={!editorFocussed}
                >
                    {beat[0]}
                </HuesButton>
            {/each}
        </div>

        <!-- Footer buttons -->
        <div class="controls">
            <!-- Backward -->
            <HuesButton icon on:click={() => {changeRate(-0.25)}}>{@html HuesIcon.BACKWARD}</HuesButton>
            <!-- Forward -->
            <HuesButton icon on:click={() => {changeRate(0.25)}}>{@html HuesIcon.FORWARD}</HuesButton>

            <!-- lazy spacer -->
            <div/>

            <span class="settings-individual">{playbackRate.toFixed(2)}x</span>
            <span class="settings-individual">New line at beat&nbsp;</span>
            <input class="settings-input" type="number" bind:value={newLineAtBeat} min=1/>
        </div>
    </div>

    <!-- Waveform -->
    {#await songLoadPromise}
        <Waveform/>
    {:then}
        <Waveform {soundManager}/>
    {:catch}
        <Waveform/>
    {/await}
{/if}
</div>

<style>
a {
    text-decoration: none;
    color: inherit;
}

hr {
    width: 100%;
}

.editor {
    position: relative;
    display: flex;
    flex-direction: column;

    max-width: calc(100% - 10px);
    width: 1000px;
    height: 100%;

    margin: 5px;

    font-size: 13px;
}

.editor-gate {
    flex-grow: 1;
    font-size: 15px;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.editor-gate-button {
    font-size: 20px;
}

.top-bar {
    display: grid;
    grid-template-columns: auto max-content;
}

.title-buttons {
    display: flex;
    align-items: center;
}

.status-msg {
    font-size: 10px;
    color: red;
    opacity: 1;

    animation-duration: 10s;
    animation-name: pulsefade;
    animation-fill-mode: forwards;
}

.info {
    display: grid;
    grid-template-columns: max-content auto;
    align-items: center;
}

.song-stats {
    display: grid;
    grid-template-columns: max-content auto;
    align-self: center;
}

.banks {
    grid-column: editor-banks;
    grid-row: 1/-1;
    align-self: center;
    text-align: center;

    display: grid;
    grid-template-columns: auto 1.5ch;
    justify-items: stretch;
}

.banks-span-both {
    grid-column: 1/-1;
}

.edit-area {
    --buildup-ratio: 1fr;
    --rhythm-ratio: 3fr;

    flex-grow: 1;
    min-height: 0;

    display: grid;
    grid-template-columns:
        [editor-banks] min-content
        [editor-link] min-content
        [editors] auto;
    /* Magically works since EditorBox has 2 sub-elements */
    grid-template-rows:
        [buildup-header] min-content
        [buildup-editor] var(--buildup-ratio)

        [drag-handle] min-content

        [rhythm-header] min-content
        [rhythm-editor] var(--rhythm-ratio);
}

.resize-handle {
    grid-row: drag-handle;
    grid-column: editors;
    width: 100%;
    height: 20px;
    cursor: row-resize;
    overflow: hidden;
}

.handle {
    transform: scale(10.0, 1.0);
    font-size: 20px;
    text-align:center;
    color: #999;
}

.handle:hover {
    color: #000;
}

.beats {
    grid-column: editors;
    display: flex;
    margin: 3px 10px 0;
}

.controls {
    grid-column: editors;
    display: grid;
    grid-template-columns: repeat(3, max-content) auto repeat(2, max-content);
    align-items: center;
    margin: 3px 10px;
}

/* hide the spin box on number input */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0; /* <-- Apparently some margin are still there even though it's hidden */
}
input[type=number] {
    -moz-appearance:textfield; /* Firefox */
}

@keyframes pulsefade {
    from {
    opacity: 0;
    }
    5% {
    opacity: 1;
    }
    10% {
    opacity: 0.5;
    }
    15% {
    opacity: 1;
    }
    20% {
    opacity: 0.5;
    }
    25% {
    opacity: 1;
    }
    30% {
    opacity: 0.5;
    }
    35% {
    opacity: 1;
    }
    40% {
    opacity: 0.5;
    }
    45% {
    opacity: 1;
    }
    50% {
    opacity: 0.5;
    }
    to {
    opacity: 0;
    }
}
</style>
