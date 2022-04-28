<script>
    import HuesButton from '../Components/HuesButton.svelte';
    import EditorBox from './EditorBox.svelte';
    import InputBox from './InputBox.svelte';
    import SongStat from './SongStats.svelte';
    import Timelock from './Timelock.svelte';
    import Waveform from './Waveform.svelte';

    import { tick, onMount, createEventDispatcher } from 'svelte';

    export let soundManager;
    export let huesRoot; // required for size calculations

    export let beatIndex;

    // because the editor takes a little CPU time, block it off til the user
    // clicks a "hey let's try this" button
    export let totallyDisabled = true;
    // if song is null
    export let disabled = true;

    // mirrored props from the song object, to make binding/events work nicely
    export let independentBuild;
    export let title;
    export let source;
    export let loop;
    export let build;
    export let undoQueue;
    export let redoQueue;
    export let songLoadPromise = Promise.reject();

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
        })
    };

    const MAX_UNDO = 200;

    let editor;
    let editArea;
    let buildupEditBox;
    let loopEditBox;
    let loopHeader;
    let resizeHandle;
    let locked; // link these together

    let buildEditorComponent;
    let loopEditorComponent;

    let helpGlow = true;

    let statusMsg = "";
    let statusAnim = false;

    $: buildIndex = (beatIndex < 0 && build.chart) ? build.chart.length + beatIndex : null;
    $: loopIndex = beatIndex >= 0 ? beatIndex : null;
    $: loopLen = loop?.chart ? loop.chart.length : NaN;
    $: hasBoth = !!build?.chart && !!loop?.chart;

    let newLineAtBeat = 32;
    let playbackRate = 1.0;

    export const alert = msg => {
        statusMsg = msg;
        // recreate the div, even if the message didn't change content
        statusAnim = !statusAnim;
    };

    // all the undo/redo stuff only initialises if it needs to, hence checking
    // if the queue is even defined yet
    const applyUndoRedo = async props => {
        // if you start saving more props, add them here
        build.chart = props.build;
        loop.chart = props.loop;
        independentBuild = props.independentBuild;
        if(props.hasOwnProperty('caret')) {
            await tick();
            props.editor.setCaret(props.caret);
        }
    };

    const undoRedoSnapshot = () => {
        return {
            build: build.chart,
            loop: loop.chart,
            independentBuild: independentBuild,
        };
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

    const pushUndo = extraProps => {
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

    const soundLen = editor => {
        if(editor == buildEditorComponent) {
            return soundManager.build.length;
        } else {
            return soundManager.loop.length;
        }
    };

    const otherEditor = oneEditor => {
        return oneEditor == buildEditorComponent ? loopEditorComponent : buildEditorComponent;
    };

    // subtract or add '.' until the child is the same beat ratio as the parent
    const resyncEditorLengths = parent => {
        if(independentBuild || !hasBoth) {
            return;
        }

        let child = otherEditor(parent);

        const secPerBeat = soundLen(parent) / parent.section.chart.length;
        let childBeats = Math.round(soundLen(child) / secPerBeat);
        // charts must have at least 1 character
        childBeats = Math.max(childBeats, 1);
        if(childBeats > child.section.chart.length) {
            const extra = childBeats - child.section.chart.length;
            child.section.chart += '.'.repeat(extra);
        } else if(childBeats < child.section.chart.length) {
            child.section.chart = child.section.chart.slice(0, childBeats);
        } else {
            return; // no change needed after all
        }

        child.section = child.section; // inform of changed data
    };

    const doubleBeats = editor => {
        editor.section.chart = editor.section.chart.replace(/(.)/g, "$1.");
        editor.section = editor.section; // inform of data change
    }
    const halveBeats = editor => {
        let ret = editor.section.chart.replace(/(.)./g, "$1");
        // don't allow an empty map
        if(!ret) {
            ret = '.';
        }
        editor.section.chart = ret;
        editor.section = editor.section; // inform of data change
    }

    const halveDouble = (parent, apply) => {
        pushUndo();

        apply(parent);
        if(!independentBuild && hasBoth) {
            apply(otherEditor(parent));
            resyncEditorLengths(parent);
        }
    };

    // not arrow functions - need `this`
    function doubleClicked(event) {
        halveDouble(this, doubleBeats);
    }
    function halveClicked(event) {
        halveDouble(this, halveBeats);
    }

    function editorBeforeInput(event) {
        pushUndo({
            caret: this.caret,
            editor: this,
        });
    }

    function editorAfterInput(event) {
        resyncEditorLengths(this, otherEditor(this));
    }

    export const resyncEditors = () => {
        resyncEditorLengths(loopEditorComponent);
    }

    const changeRate = change => {
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

    const resizeMousedown = (e) => {
        e.preventDefault();

        let handleSize = resizeHandle.clientHeight;
        let handleMin = buildupEditBox.getBoundingClientRect().top + handleSize/2;
        let handleMax = loopEditBox.getBoundingClientRect().bottom - loopHeader.clientHeight - handleSize/2;
        let handleRange = handleMax - handleMin;

        let resizer = (e) => {
            let clamped = Math.max(handleMin, Math.min(handleMax, e.clientY));
            let percent = (clamped - handleMin) / handleRange;

            editArea.style.setProperty('--buildup-ratio', percent + "fr");
            editArea.style.setProperty('--rhythm-ratio', (1 - percent) + "fr");
        };

        let mouseup = function(e) {
            document.removeEventListener("mousemove", resizer);
            document.removeEventListener("mouseup", mouseup);
        };

        document.addEventListener("mousemove", resizer);
        document.addEventListener("mouseup", mouseup);
    };

    const keydown = event => {
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

        <EditorBox
            title="Buildup"
            bind:this={buildEditorComponent}
            bind:section={build}
            bind:editBox={buildupEditBox}
            bind:locked={locked}
            on:rewind={() => soundManager.seek(-soundManager.build.length)}
            on:seek={event => soundManager.seek(-soundManager.build.length * (1 - event.detail))}
            on:error={event => alert(event.detail)}
            on:songload={event => dispatch('loadbuildup', event)}
            on:double={doubleClicked}
            on:halve={halveClicked}
            on:beforeinput={editorBeforeInput}
            on:afterinput={editorAfterInput}
            on:songremove
            on:songnew
            beatIndex={buildIndex}
            {newLineAtBeat}
            {soundManager}
        />

        <div title="Resize" class="resize-handle" on:mousedown={resizeMousedown} bind:this={resizeHandle}>
            <!-- DRAG HANDLE -->
            <div class="hues-icon handle">&#xe908;</div>
        </div>

        <EditorBox
            title="Rhythm"
            showHelp=true
            bind:this={loopEditorComponent}
            bind:section={loop}
            bind:header={loopHeader}
            bind:editBox={loopEditBox}
            bind:locked={locked}
            on:rewind={() => soundManager.seek(0)}
            on:seek={event => soundManager.seek(soundManager.loop.length * event.detail)}
            on:error={event => alert(event.detail)}
            on:songload={event => dispatch('loadrhythm', event)}
            on:double={doubleClicked}
            on:halve={halveClicked}
            on:beforeinput={editorBeforeInput}
            on:afterinput={editorAfterInput}
            on:songremove
            on:songnew
            beatIndex={loopIndex}
            {newLineAtBeat}
            {soundManager}
        />

        <!-- Footer buttons -->
        <div class="controls">
            <!-- Backward -->
            <HuesButton icon on:click={() => {changeRate(-0.25)}}>&#xe909;</HuesButton>
            <!-- Forward -->
            <HuesButton icon on:click={() => {changeRate(0.25)}}>&#xe90a;</HuesButton>

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

.edit-area {
    --buildup-ratio: 1fr;
    --rhythm-ratio: 3fr;

    flex-grow: 1;
    min-height: 0;

    display: grid;
    grid-template-columns:
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

.controls {
    grid-column: editors;
    display: grid;
    grid-template-columns: repeat(3, max-content) auto repeat(2, max-content);
    align-items: center;
    margin: 10px;
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
