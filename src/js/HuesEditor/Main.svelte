<script lang="ts">
  import { run } from "svelte/legacy";

  import HuesButton from "../Components/HuesButton.svelte";
  import EditorBox from "./EditorBox.svelte";
  import InputBox from "./InputBox.svelte";
  import SongStat from "./SongStats.svelte";
  import Timelock from "./Timelock.svelte";
  import Waveform from "./Waveform.svelte";

  import { tick, onMount, createEventDispatcher } from "svelte";

  import type SoundManager from "../SoundManager";
  import type { HuesSong } from "../ResourcePack.svelte";
  import type { EditorUndoRedo } from "../HuesEditor.svelte";
  import { HuesIcon } from "../HuesIcon";

  interface Props {
    soundManager: SoundManager;
    huesRoot: HTMLElement; // required for size calculations
    beatIndex?: number;
    // because the editor takes a little CPU time, block it off til the user
    // clicks a "hey let's try this" button
    totallyDisabled?: boolean;
    // mirrored props from the song object, to make binding/events work nicely
    song?: HuesSong | undefined;
    songLoadPromise?: Promise<void>;
    locked?: boolean; // link these together
  }

  let {
    soundManager,
    huesRoot,
    beatIndex = 0,
    totallyDisabled = $bindable(true),
    song = $bindable(undefined),
    songLoadPromise = Promise.reject(),
    locked = $bindable(false),
  }: Props = $props();

  // and until we convert the rest of the app to svelte, this lets consumers
  // update their own state more simply
  const dispatch = createEventDispatcher();
  run(() => {
    song?.independentBuild;
    song?.title;
    song?.source;
    song?.loop;
    song?.build;
    song?.hiddenBanks;
    song?.undoQueue;
    song?.redoQueue;
    dispatch("update");
  });

  const MAX_UNDO = 200;

  // different to HuesInfo - does not combine similar beats into a single line
  const beatGlossary = {
    Blur: [
      ["x", "Vertical blur"],
      ["o", "Horizontal blur"],
      ["X", "Vertical blur only"],
      ["O", "Horizontal blur only"],
    ],
    Colour: [
      ["-", "Change image"],
      [":", "Color only"],
      ["*", "Image only"],
      ["~", "Fade color"],
      ["=", "Fade and change image"],
      ["i", "Invert all colours"],
      ["I", "Invert & change image"],
      ["ı", "Fade invert"],
    ],
    Blackout: [
      ["+", "Blackout"],
      ["¤", "Whiteout"],
      ["|", "Short blackout"],
      ["!", "Short whiteout"],
      ["┊", "Instant blackout"],
      ["¡", "Instant whiteout"],
      ["▼", "Fade to black"],
      ["▽", "Fade to white"],
      ["▲", "Fade in from black"],
      ["△", "Fade in from white"],
    ],
    Trippy: [
      [")", "Trippy cirle in and change image"],
      ["(", "Trippy circle out and change image"],
      [">", "Trippy cirle in"],
      ["<", "Trippy circle out"],
    ],
    Slice: [
      ["s", "Horizontal slice"],
      ["S", "Horizontal slice and change image"],
      ["v", "Vertical slice"],
      ["V", "Vertical slice and change image"],
      ["#", "Double slice"],
      ["@", "Double slice and change image"],
    ],
    Shutter: [
      ["←", "Shutter left"],
      ["↓", "Shutter down"],
      ["↑", "Shutter up"],
      ["→", "Shutter right"],
    ],
    Util: [
      ["¯", "Stop all effects immediately"],
      ["_", "Stop timed effects"],
    ],
  };

  let editor: HTMLDivElement = $state() as HTMLDivElement;
  let editArea: HTMLDivElement = $state() as HTMLDivElement;
  let buildupEditBox: HTMLDivElement = $state() as HTMLDivElement;
  let loopEditBox: HTMLDivElement = $state() as HTMLDivElement;
  let loopHeader: HTMLDivElement = $state() as HTMLDivElement;
  let resizeHandle: HTMLDivElement = $state() as HTMLDivElement;

  let buildEditorComponent: EditorBox = $state() as EditorBox;
  let loopEditorComponent: EditorBox = $state() as EditorBox;
  let editorFocus: EditorBox | null = $state(null);

  let helpGlow = $state(true);

  let statusMsg = $state("");
  let statusAnim = $state(false);

  let disabled = $derived(!song);
  let buildIndex = $derived(
    beatIndex < 0 && song?.build ? song.build.mapLen + beatIndex : null,
  );
  let loopIndex = $derived(beatIndex >= 0 ? beatIndex : null);
  let loopLen = $derived(song?.loop ? song.loop.mapLen : NaN);
  let hasBoth = $derived(song?.build && song?.loop);
  let editorFocussed = $derived(editorFocus !== null);

  let newLineAtBeat = $state(32);
  let playbackRate = $state(1.0);

  export const alert = (msg: string) => {
    statusMsg = msg;
    // recreate the div, even if the message didn't change content
    statusAnim = !statusAnim;
  };

  // all the undo/redo stuff only initialises if it needs to, hence checking
  // if the queue is even defined yet
  const applyUndoRedo = async (props: EditorUndoRedo | undefined) => {
    // shouldn't happen but anyway...
    if (props === undefined || song === undefined) {
      return;
    }

    // if you start saving more props, add them here
    if (song.build && props.builds) {
      song.build.banks = props.builds;
    }
    if (props.loops) {
      song.loop.banks = props.loops;
    }

    song.independentBuild = props.independentBuild;
    if (props.caret !== undefined) {
      await tick();
      props.editor?.setCaret(props.caret);
    }
  };

  const undoRedoSnapshot = (): EditorUndoRedo => {
    let ret: EditorUndoRedo = {
      independentBuild: song!.independentBuild,
    };

    if (song!.build) {
      ret.builds = [...song!.build.banks];
    }
    if (song!.loop) {
      ret.loops = [...song!.loop.banks];
    }

    return ret;
  };

  const undo = () => {
    if (!song?.undoQueue) {
      return;
    }
    if (!song.redoQueue) {
      song.redoQueue = [];
    }

    song.redoQueue.push(undoRedoSnapshot());

    applyUndoRedo(song.undoQueue.pop());
  };

  const redo = () => {
    if (!song?.redoQueue) {
      return;
    }
    if (!song.undoQueue) {
      song.undoQueue = [];
    }
    song.undoQueue.push(undoRedoSnapshot());

    applyUndoRedo(song.redoQueue.pop());
  };

  const pushUndo = (extraProps?: Partial<EditorUndoRedo>) => {
    if (!song) return;

    if (!song.undoQueue) {
      song.undoQueue = [];
    }
    song.redoQueue = [];

    let props = undoRedoSnapshot();
    if (extraProps) {
      Object.assign(props, extraProps);
    }

    song.undoQueue.push(props);
    while (song.undoQueue.length > MAX_UNDO) {
      song.undoQueue.shift();
    }

    song.undoQueue = song.undoQueue;
  };

  const soundLen = (editor: EditorBox) => {
    if (editor == buildEditorComponent) {
      return soundManager.build.length;
    } else {
      return soundManager.loop.length;
    }
  };

  const otherEditor = (oneEditor: EditorBox) => {
    return oneEditor == buildEditorComponent
      ? loopEditorComponent
      : buildEditorComponent;
  };

  // subtract or add '.' until the child is the same beat ratio as the parent
  const resyncEditorLengths = (parent: EditorBox) => {
    parent.section?.recalcBeatString();

    if (song?.independentBuild || !hasBoth) {
      return;
    }

    let child = otherEditor(parent);

    let changed = false;
    for (let i = 0; i < parent.section!.banks.length; i++) {
      const secPerBeat = soundLen(parent) / parent.section!.banks[i].length;
      let childBeats = Math.round(soundLen(child) / secPerBeat);
      // charts must have at least 1 character
      childBeats = Math.max(childBeats, 1);
      if (childBeats > child.section!.banks[i].length) {
        const extra = childBeats - child.section!.banks[i].length;
        child.section!.banks[i] += ".".repeat(extra);
        changed = true;
      } else if (childBeats < child.section!.banks[i].length) {
        child.section!.banks[i] = child.section!.banks[i].slice(0, childBeats);
        changed = true;
      }
    }

    if (!changed) {
      return; // no change needed after all
    }

    child.section!.recalcBeatString();
    child.section = child.section; // inform of changed data
  };

  const doubleBeats = (editor: EditorBox) => {
    for (let i = 0; i < editor.section!.banks.length; i++) {
      editor.section!.banks[i] = editor.section!.banks[i]!.replace(
        /(.)/g,
        "$1.",
      );
    }
    editor.section = editor.section; // inform of data change
  };
  const halveBeats = (editor: EditorBox) => {
    for (let i = 0; i < editor.section!.banks.length; i++) {
      let ret = editor.section!.banks[i].replace(/(.)./g, "$1");
      // don't allow an empty map
      if (!ret) {
        ret = ".";
      }
      editor.section!.banks[i] = ret;
    }
    editor.section = editor.section; // inform of data change
  };

  const halveDouble = (parent: EditorBox, apply: (e: EditorBox) => void) => {
    pushUndo();

    apply(parent);
    if (!song?.independentBuild && hasBoth) {
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
  };

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
  };

  // unlike all the other info tabs, we want the editor to *grow* to fit
  // all the available space, instead of being the minimum possible size.
  let resize = () => {
    editor.style.minHeight = huesRoot.clientHeight - 260 + "px";
  };

  onMount(resize);

  const resizeMousedown = (e: MouseEvent) => {
    e.preventDefault();

    let handleSize = resizeHandle.clientHeight;
    let handleMin = buildupEditBox.getBoundingClientRect().top + handleSize / 2;
    let handleMax =
      loopEditBox.getBoundingClientRect().bottom -
      loopHeader.clientHeight -
      handleSize / 2;
    let handleRange = handleMax - handleMin;

    let resizer = (e: MouseEvent) => {
      let clamped = Math.max(handleMin, Math.min(handleMax, e.clientY));
      let percent = (clamped - handleMin) / handleRange;

      editArea.style.setProperty("--buildup-ratio", percent + "fr");
      editArea.style.setProperty("--rhythm-ratio", 1 - percent + "fr");
    };

    let mouseup = () => {
      document.removeEventListener("mousemove", resizer);
      document.removeEventListener("mouseup", mouseup);
    };

    document.addEventListener("mousemove", resizer);
    document.addEventListener("mouseup", mouseup);
  };

  const keydown = (event: KeyboardEvent) => {
    if (!event.ctrlKey) {
      return;
    }

    if (event.key == "z") {
      undo();
    } else if (event.key == "y") {
      redo();
    } else {
      return;
    }

    event.preventDefault();
  };
</script>

<svelte:window onresize={resize} onkeydown={keydown} />

<div class="editor" bind:this={editor}>
  {#if totallyDisabled}
    <!-- swallow the error we deliberately make so it doesn't appear in the
         console -->
    {#await songLoadPromise catch}<div style="display:none;"></div>{/await}

    <div class="editor-gate">
      <div>Ready to go?</div>
      <HuesButton
        on:click={() => {
          totallyDisabled = false;
        }}
      >
        <span class="editor-gate-button">Activate Editor</span>
      </HuesButton>
    </div>
  {:else}
    <!-- Header buttons -->
    <div class="title-buttons">
      <HuesButton on:click={() => dispatch("songnew")}>New Song</HuesButton>
      <HuesButton on:click={() => dispatch("savezip")} {disabled}
        >Save ZIP</HuesButton
      >
      <HuesButton on:click={() => dispatch("savexml")} {disabled}
        >Save XML</HuesButton
      >
      <HuesButton on:click={() => dispatch("copyxml")} {disabled}
        >Copy XML</HuesButton
      >
      <HuesButton
        on:click={() => undo()}
        disabled={!song?.undoQueue || !song.undoQueue.length}>Undo</HuesButton
      >
      <HuesButton
        on:click={() => redo()}
        disabled={!song?.redoQueue || !song.redoQueue.length}>Redo</HuesButton
      >
      <HuesButton glow={helpGlow} on:click={() => (helpGlow = false)}>
        <a
          href="https://github.com/mon/0x40-web/tree/master/docs/Editor.md"
          target="_blank">Help?</a
        >
      </HuesButton>

      {#key statusAnim}
        <span class="status-msg">{statusMsg}</span>
      {/key}
    </div>

    <div class="top-bar">
      <!-- Metadata -->
      <div class="info">
        <InputBox
          bind:value={
            () => song?.title ?? "",
            (v) => {
              if (song) song.title = v;
            }
          }
          label="Title:"
          placeholder="Song name"
          {disabled}
        />
        <InputBox
          bind:value={
            () => song?.source ?? "",
            (v) => {
              if (song) song.source = v;
            }
          }
          label="Link:"
          placeholder="Source link (YouTube, Soundcloud, etc)"
          {disabled}
        />
      </div>

      <!-- Calculated data -->
      <div class="settings-individual song-stats">
        <!-- There is probably a nicer way to achieve this... -->
        {#await songLoadPromise}
          <SongStat label="Loop" unit="s" value="..." />
          <SongStat label="Build" unit="s" value="..." />
          <SongStat label="Beats" unit="ms" value="..." />
          <SongStat label="" unit="bpm" value="..." />
        {:then}
          <SongStat
            label="Loop"
            unit="s"
            value={soundManager.loop.length.toFixed(2)}
          />
          <SongStat
            label="Build"
            unit="s"
            value={soundManager.build.length.toFixed(2)}
          />
          <SongStat
            label="Beats"
            unit="ms"
            value={((soundManager.loop.length / loopLen) * 1000).toFixed(2)}
          />
          <SongStat
            label=""
            unit="bpm"
            value={(60 / (soundManager.loop.length / loopLen)).toFixed(2)}
          />
        {:catch}
          <SongStat label="Loop" unit="s" value="???" />
          <SongStat label="Build" unit="s" value="???" />
          <SongStat label="Beats" unit="ms" value="???" />
          <SongStat label="" unit="bpm" value="???" />
        {/await}
      </div>
    </div>

    <hr />

    <!-- Editor zone -->
    <div class="edit-area" bind:this={editArea}>
      <Timelock
        bind:unlocked={
          () => song?.independentBuild,
          (v) => {
            if (song) song.independentBuild = v ?? false;
          }
        }
        on:click={() => {
          pushUndo();
          resyncEditorLengths(loopEditorComponent);
        }}
        disabled={!hasBoth}
      />

      <div class="banks">
        <div class="banks-span-both">BANKS</div>
        {#if song?.loop}
          {#each song.loop.banks as bank, i}
            <HuesButton
              nopad
              title="Toggle bank visibility"
              on:click={() => {
                song.hiddenBanks[i] = !song.hiddenBanks[i];
              }}
            >
              {i + 1}
              <span class="hues-icon"
                >{@html song.hiddenBanks[i]
                  ? HuesIcon.EYE_CLOSED
                  : "&emsp;"}</span
              >
            </HuesButton>
            {#if song.loop.banks.length == 1}
              <div></div>
            {:else}
              <HuesButton
                nopad
                nouppercase
                title="Remove bank"
                on:click={() => {
                  pushUndo();
                  song.removeBank(i);
                }}
              >
                x
              </HuesButton>
            {/if}
          {/each}
          {#if song.loop.banks.length < 16}
            <div class="banks-span-both">
              <HuesButton
                title="Add bank"
                on:click={() => {
                  pushUndo();
                  song.addBank();
                }}
              >
                +
              </HuesButton>
            </div>
          {/if}
        {/if}
      </div>

      <EditorBox
        title="Buildup"
        bind:this={buildEditorComponent}
        bind:section={
          () => song?.build,
          (v) => {
            if (song) song.build = v;
          }
        }
        bind:editBox={buildupEditBox}
        bind:locked
        on:rewind={() => soundManager.seek(-soundManager.build.length)}
        on:seek={(event) =>
          soundManager.seek(-soundManager.build.length * (1 - event.detail))}
        on:error={(event) => alert(event.detail)}
        on:songload={(event) => dispatch("loadbuildup", event.detail)}
        on:double={doubleClicked}
        on:halve={halveClicked}
        on:beforeinput={editorBeforeInput}
        on:afterinput={editorAfterInput}
        on:focus={editorOnfocus}
        on:songremove={(event) => dispatch("removebuildup")}
        on:songnew
        beatIndex={buildIndex}
        {newLineAtBeat}
        {soundManager}
        hiddenBanks={song?.hiddenBanks}
      />

      <div
        title="Resize"
        class="resize-handle"
        onmousedown={resizeMousedown}
        bind:this={resizeHandle}
      >
        <!-- MENU looks like a drag handle when wide enough -->
        <div class="hues-icon handle">{@html HuesIcon.MENU}</div>
      </div>

      <EditorBox
        title="Rhythm"
        showHelp
        bind:this={loopEditorComponent}
        bind:section={
          () => song?.loop,
          (v) => {
            if (song) song.loop = v!;
          }
        }
        bind:header={loopHeader}
        bind:editBox={loopEditBox}
        bind:locked
        on:rewind={() => soundManager.seek(0)}
        on:seek={(event) =>
          soundManager.seek(soundManager.loop.length * event.detail)}
        on:error={(event) => alert(event.detail)}
        on:songload={(event) => dispatch("loadrhythm", event.detail)}
        on:double={doubleClicked}
        on:halve={halveClicked}
        on:beforeinput={editorBeforeInput}
        on:afterinput={editorAfterInput}
        on:focus={editorOnfocus}
        on:songremove={(event) => dispatch("removerhythm")}
        on:songnew
        beatIndex={loopIndex}
        {newLineAtBeat}
        {soundManager}
        hiddenBanks={song?.hiddenBanks}
      />

      <!-- Beat inserter buttons -->
      <div class="beats">
        {#each Object.entries(beatGlossary) as [category, beats]}
          <div>
            <span class="beat-category">{category}</span>
            {#each beats as beat}
              <HuesButton
                title={beat[1]}
                on:click={() => {
                  if (editorFocus) editorFocus.fakeInput(beat[0]);
                }}
                nouppercase
                disabled={!editorFocussed}
              >
                {beat[0]}
              </HuesButton>
            {/each}
          </div>
        {/each}
      </div>

      <!-- Footer buttons -->
      <div class="controls">
        <!-- Backward -->
        <HuesButton
          icon
          on:click={() => {
            changeRate(-0.25);
          }}>{@html HuesIcon.BACKWARD}</HuesButton
        >
        <!-- Forward -->
        <HuesButton
          icon
          on:click={() => {
            changeRate(0.25);
          }}>{@html HuesIcon.FORWARD}</HuesButton
        >

        <!-- lazy spacer -->
        <div></div>

        <span class="settings-individual">{playbackRate.toFixed(2)}x</span>
        <span class="settings-individual">New line at beat&nbsp;</span>
        <input
          class="settings-input"
          type="number"
          bind:value={newLineAtBeat}
          min="1"
        />
      </div>
    </div>

    <!-- Waveform -->
    {#await songLoadPromise}
      <Waveform />
    {:then}
      <Waveform {soundManager} />
    {:catch}
      <Waveform />
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
    flex-wrap: wrap;
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
    /* without this, mobile users cannot see the beatmap at all */
    min-height: 300px;

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
    transform: scale(10, 1);
    font-size: 20px;
    text-align: center;
    color: #999;
  }

  .handle:hover {
    color: #000;
  }

  .beats {
    grid-column: editors;
    display: flex;
    flex-wrap: wrap;
    margin: 3px 10px 0;
  }

  .controls {
    grid-column: editors;
    display: grid;
    grid-template-columns: repeat(3, max-content) auto repeat(2, max-content);
    align-items: center;
    margin: 3px 10px;
  }

  .beat-category {
    font-size: 10px;
    margin-left: 4px;
    /* really not sure why I need this */
    margin-right: -9px;
  }

  @media (max-width: 470px) {
    .controls {
      display: flex;
      flex-wrap: wrap;
    }
  }

  /* hide the spin box on number input */
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0; /* <-- Apparently some margin are still there even though it's hidden */
  }
  input[type="number"] {
    appearance: textfield;
    -moz-appearance: textfield; /* Firefox */
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
